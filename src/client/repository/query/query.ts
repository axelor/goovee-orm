import { QueryBuilder, SelectQueryBuilder } from "typeorm";
import { ensureLazy, isLazy } from "../../fields/utils";
import {
  ParseResult,
  createCursor,
  isPageQuery,
  parseCursor,
} from "../../parser";
import { OrmRepository } from "../types";
import {
  createSelectQuery,
  nestedPaginationFilter,
  orderReferencesOnlySelf,
  relationQuery,
  toSqlOrder,
} from "./utils";

export const runQuery = async (
  repo: OrmRepository<any>,
  builder: QueryBuilder<any>,
  options: ParseResult,
) => {
  return doQuery(repo, builder, options).then((x) => x.entities);
};

type QueryResult<T> = {
  entities: T[];
  raw: Record<string, any>[];
};

/**
 * The single take/skip rule: the index window [start, end) selected from a
 * list of `count` items. A negative take selects from the end, and skip then
 * counts from the end too, clamped at the list start. The top-level query,
 * the in-memory fallback, and — using each partition's `count(*)` as `count`
 * — the ranked-subquery filter all realize this same window.
 */
const takeSkipBounds = (count: number, take: number, skip: number) => {
  const start = Math.max(0, take >= 0 ? skip : count - skip + take);
  const end = take === 0 ? count : start + Math.abs(take);
  return [start, end] as const;
};

// In-memory realization of the rule; fallback for when the ranked-subquery
// filter cannot be used.
const applyTakeSkip = (items: any[], take: number, skip: number) => {
  const [start, end] = takeSkipBounds(items.length, take, skip);
  return items.slice(start, end);
};

/**
 * Whether any join in the chain traverses a collection (one-to-many /
 * many-to-many) — such joins multiply the fetched rows. Joins are recorded
 * parent-first (`self.country` before `self_country.regions`), so aliases
 * resolve in one pass; anything unresolvable is treated as multi-valued to
 * stay on the safe path.
 */
const hasMultiValuedJoin = (
  repo: OrmRepository<any>,
  joins: Record<string, string> = {},
) => {
  const repoByAlias: Record<string, OrmRepository<any>> = { self: repo };
  for (const [name, alias] of Object.entries(joins)) {
    const [parentAlias, property] = name.split(".");
    const parentRepo = repoByAlias[parentAlias];
    const relation =
      parentRepo?.metadata.findRelationWithPropertyPath(property);
    if (!relation) return true;
    if (relation.isOneToMany || relation.isManyToMany) return true;
    repoByAlias[alias] = parentRepo.manager.getRepository(
      relation.inverseEntityMetadata.target,
    );
  }
  return false;
};

const doQuery = async (
  repo: OrmRepository<any>,
  builder: QueryBuilder<any>,
  options: ParseResult,
): Promise<QueryResult<any>> => {
  const { references = {}, collections = {}, select = {} } = options;

  const lazyFields = Object.keys(select).filter((x) => isLazy(repo, x));
  const normalSelect = Object.entries(select)
    .filter(([x]) => !lazyFields.includes(x))
    .reduce((prev, [k, v]) => ({ ...prev, [k]: v }), {});

  const opts = options.select ? { ...options, select: normalSelect } : options;
  const sq = createSelectQuery(builder, opts);

  let count = -1;
  const { cursor } = options;
  let take = options.take ?? 0;
  let skip = options.skip ?? 0;
  if (isPageQuery(options)) {
    count = await sq.getCount();
    if (cursor) {
      // with a cursor, direction is handled by the cursor ordering itself
      take = Math.abs(take);
    } else {
      const [start, end] = takeSkipBounds(count, take, skip);
      skip = start;
      take = end - start;
    }
  }

  const noResult: QueryResult<any> = {
    entities: [],
    raw: [],
  };

  if (count === 0) {
    return noResult;
  }

  if (take > 0) sq.take(take);
  if (skip > 0) sq.skip(skip);

  if (cursor) {
    const cur = parseCursor(options);
    if (cur.where) {
      sq.andWhere(cur.where, cur.params);
    }
    if (cur.order) {
      // when fetching previous page with a cursor we have to invert
      // the original ordering first to get required data and finally
      // return the result with the requested order.
      const sub = new SelectQueryBuilder(sq).orderBy(toSqlOrder(cur.order));
      const res = await sub.getMany();
      const ids = res.map((x) => x.id);
      if (ids.length === 0) return noResult;
      sq.where("self.id IN (:...ids)", { ids }).take(undefined).skip(undefined);
    }
  }

  const { entities: records, raw: rawRecords } = await sq.getRawAndEntities();

  const relations = [
    ...Object.entries(references),
    ...Object.entries(collections),
  ];

  const ids = records.map((x) => x.id);
  if (ids.length === 0) {
    return noResult;
  }

  for (const [property, opts] of relations) {
    const relation = repo.metadata.findRelationWithPropertyPath(property);
    if (!relation) {
      throw new Error(
        `No such relation exits: ${repo.metadata.name}#${property}`,
      );
    }

    const rr = repo.manager.getRepository(
      relation.inverseEntityMetadata.target,
    );

    const isCollection = property in collections;

    // A nested take/skip must paginate each parent's list, but the related
    // records are fetched with a single batched query for the whole page of
    // parents — a LIMIT there would cap the page-wide batch, not each list.
    // So strip them from the child query; a ranked-subquery filter (or, see
    // below, an in-memory slice) applies them per parent instead. A nested
    // cursor cannot combine with the per-record window, so it is dropped
    // along with them. With a single parent (e.g. findOne, or the GraphQL
    // nested connection resolver) the batch IS that record's list, so the
    // options pass through untouched and keep their top-level semantics —
    // including the cursor and the _count/_cursor page metadata.
    const { take: nestedTake, skip: nestedSkip, ...childOpts } = opts;
    const childTake = nestedTake ?? 0;
    const childSkip = Math.max(0, nestedSkip ?? 0);
    const childPaginated =
      isCollection && ids.length > 1 && (childTake !== 0 || childSkip > 0);
    if (childPaginated) {
      delete childOpts.cursor;
    }
    const effectiveOpts = childPaginated ? childOpts : opts;

    // nested joins through another collection multiply the child rows
    // (handled with distinct below); the ranked filter dedupes them too, but
    // only per (parent, item, order values) — so when the ORDER itself
    // reaches through a collection (ambiguous per item), fetch the full
    // lists and slice in memory instead
    const hasCollectionJoin = hasMultiValuedJoin(rr, opts.joins);
    const sliceInMemory =
      childPaginated && hasCollectionJoin && !orderReferencesOnlySelf(opts);

    const nq = relationQuery(repo.manager, relation)
      .query.clone()
      .setParameter("__parents", ids);

    if (childPaginated && !sliceInMemory) {
      const filter = nestedPaginationFilter(
        repo.manager,
        relation,
        opts,
        childTake,
        childSkip,
        hasCollectionJoin,
      );
      nq.andWhere(filter.condition, filter.params);
    }

    // Add `self.id` and `self.version` to prevent `createSelectQuery`
    // to start selection from scratch
    const oo = {
      ...effectiveOpts,
      select: {
        ...effectiveOpts.select,
        "self.id": "self_id",
        "self.version": "self.version",
      },
    };

    // we need distinct for nested relations with multi-value joins
    if (hasCollectionJoin) {
      oo.distinct = true;
    }

    const { entities: items, raw: rawItems } = await doQuery(rr, nq, oo);

    const itemsById = items.reduce((group, item) => {
      return {
        ...group,
        [item.id]: item,
      };
    }, {});

    const itemsByParent = rawItems.reduce((group, item) => {
      const parent = item.__parent;
      const values = group[parent] ?? [];
      group[parent] = [...values, item.self_id];
      return group;
    }, {});

    for (const record of records) {
      const relatedIds: any[] = itemsByParent[record.id] || [];
      let related = relatedIds.map((x) => itemsById[x]);
      if (sliceInMemory) {
        related = applyTakeSkip(related, childTake, childSkip);
      }
      record[property] =
        property in references ? (related.length ? related[0] : null) : related;
    }
  }

  // handle lazy fields
  for (const field of lazyFields) {
    for (const record of records) {
      ensureLazy(repo, record, field);
    }
  }

  // enhance record with count and cursor
  if (isPageQuery(options)) {
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rawRecord = rawRecords[i];
      const cur = createCursor(options, rawRecord);
      record._count = count;
      record._cursor = cur;
    }

    // Calculate pagination flags efficiently without additional queries
    const start = records[0];
    const end = records[records.length - 1];

    if (start && end) {
      const backward = !!cursor && (options.take ?? 0) < 0;

      // _hasPrev: rows exist before this page — a skip offset, or the row a
      // forward cursor points at; going backward, a short page means the
      // list start was reached
      start._hasPrev = cursor ? !backward || records.length === take : skip > 0;

      // _hasNext: rows exist after this page. The count locates a plain
      // page exactly, but not a cursor page (the count ignores the cursor
      // filter) — there a short page signals the end, while the row a
      // backward cursor points at is always next
      end._hasNext = cursor
        ? backward || records.length === take
        : count > skip + records.length;
    }
  }

  return {
    entities: records,
    raw: rawRecords,
  };
};
