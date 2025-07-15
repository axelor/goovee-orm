import { QueryBuilder, SelectQueryBuilder } from "typeorm";
import { isLazy, ensureLazy } from "../../fields/utils";
import { ParseResult, isPageQuery, parseCursor, createCursor } from "../../parser";
import { OrmRepository } from "../types";
import { createSelectQuery, relationQuery } from "./utils";


export const runQuery = async (
  repo: OrmRepository<any>,
  builder: QueryBuilder<any>,
  options: ParseResult
) => {
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

  if (count === 0) {
    return [];
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
      if (ids.length === 0) return [];
      sq.where("self.id IN (:...ids)", { ids }).take(undefined).skip(undefined);
    }
  }

  const { entities: records, raw: rawRecords } = await sq.getRawAndEntities();

  const relations = [
    ...Object.entries(references),
    ...Object.entries(collections),
  ];

  for (const [property, opts] of relations) {
    const relation = repo.metadata.findRelationWithPropertyPath(property);
    if (!relation) {
      throw new Error(
        `No such relation exits: ${repo.metadata.name}#${property}`
      );
    }

    const rq = relationQuery(repo.manager, relation);
    const rr = repo.manager.getRepository(relation.inverseEntityMetadata.name);

    for (const record of records) {
      const nq = rq.clone().setParameter("__parent", record.id);
      const related = await runQuery(rr, nq, opts);
      record[property] =
        property in references
          ? related && related.length
            ? related[0]
            : null
          : related;
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

  return records;
};
