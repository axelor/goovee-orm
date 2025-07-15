import { QueryBuilder, SelectQueryBuilder } from "typeorm";
import { ensureLazy, isLazy } from "../../fields/utils";
import {
  ParseResult,
  createCursor,
  isPageQuery,
  parseCursor,
} from "../../parser";
import { OrmRepository } from "../types";
import { createSelectQuery, relationQuery } from "./utils";

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
  let { take = 0, skip = 0, cursor } = options;
  if (isPageQuery(options)) {
    count = await sq.getCount();
    skip = take >= 0 || cursor ? skip : count - skip + take;
    take = Math.abs(take);
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
      const sub = new SelectQueryBuilder(sq).orderBy(cur.order);
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

    const rr = repo.manager.getRepository(relation.inverseEntityMetadata.name);
    const nq = relationQuery(repo.manager, relation)
      .clone()
      .setParameter("__parents", ids);

    // Add `self.id` and `self.version` to prevent `createSelectQuery`
    // to start selection from scratch
    const oo = {
      ...opts,
      select: {
        ...opts.select,
        "self.id": "self_id",
        "self.version": "self.version",
      },
    };

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
      const related = relatedIds.map((x) => itemsById[x]);
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
      // _hasPrev: true if we have a skip value (not at beginning) or if cursor indicates we're not at start
      start._hasPrev = skip > 0 || (cursor && take > 0);

      // _hasNext: true if we fetched exactly 'take' records and there might be more
      // This is determined by: (skip + records.length) < count
      end._hasNext = count > skip + records.length;
    }
  }

  return {
    entities: records,
    raw: rawRecords,
  };
};
