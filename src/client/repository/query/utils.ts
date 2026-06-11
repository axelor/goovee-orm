import { EntityManager, OrderByCondition, QueryBuilder } from "typeorm";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata.js";
import { parseQuery, ParseResult } from "../../parser";
import type { Entity, OrderBy, QueryClient, WhereOptions } from "../../types";
import { OrmRepository } from "../types";

type OrderByValue = OrderByCondition[string];

const SQL_ORDER: Record<string, OrderByValue> = {
  ASC: "ASC",
  DESC: "DESC",
  ASC_NULLS_FIRST: { order: "ASC", nulls: "NULLS FIRST" },
  ASC_NULLS_LAST: { order: "ASC", nulls: "NULLS LAST" },
  DESC_NULLS_FIRST: { order: "DESC", nulls: "NULLS FIRST" },
  DESC_NULLS_LAST: { order: "DESC", nulls: "NULLS LAST" },
};

export const toSqlOrder = (order: Record<string, string>): OrderByCondition =>
  Object.entries(order).reduce(
    (prev, [k, v]) => ({ ...prev, [k]: SQL_ORDER[v] }),
    {} as OrderByCondition,
  );

// the same mapping as raw SQL text, for places TypeORM's OrderByCondition
// cannot reach (e.g. inside a window's OVER clause)
const sqlOrderText = (order: string) => {
  const mapped = SQL_ORDER[order] ?? "ASC";
  return typeof mapped === "string"
    ? mapped
    : `${mapped.order} ${mapped.nulls}`;
};

export const relationQuery = (
  manager: EntityManager,
  relation: RelationMetadata,
) => {
  const entityTable = relation.entityMetadata.tableName;
  const targetTable = relation.inverseEntityMetadata.tableName;

  const mappedBy = relation.inverseRelation?.joinColumns?.[0]?.databaseName;

  const joinTable = relation.joinTableName;
  const joinColumn = relation.joinColumns?.[0]?.databaseName;
  const inverseJoinColumn = relation.inverseJoinColumns?.[0]?.databaseName;

  if (relation.isManyToOne || (relation.isOneToOne && joinColumn)) {
    const parentColumn = "joined.id";
    return {
      parentColumn,
      query: manager
        .createQueryBuilder()
        .from(targetTable, "self")
        .select("self.id")
        .addSelect("self.version")
        .addSelect(`${parentColumn} as __parent`)
        .innerJoin(entityTable, "joined", `joined.${joinColumn} = self.id`)
        .where("joined.id IN (:...__parents)"),
    };
  }

  if (relation.isOneToOne && !joinColumn) {
    const parentColumn = "joined.id";
    return {
      parentColumn,
      query: manager
        .createQueryBuilder()
        .from(targetTable, "self")
        .select("self.id")
        .addSelect("self.version")
        .addSelect(`${parentColumn} as __parent`)
        .innerJoin(entityTable, "joined", `joined.id = self.${mappedBy}`)
        .where("joined.id IN (:...__parents)"),
    };
  }

  if (relation.isOneToMany) {
    const parentColumn = `self.${mappedBy}`;
    return {
      parentColumn,
      query: manager
        .createQueryBuilder()
        .from(targetTable, "self")
        .select("self.id")
        .addSelect("self.version")
        .addSelect(`${parentColumn} as __parent`)
        .where(`self.${mappedBy} IN (:...__parents)`),
    };
  }

  // owner side many-to-many
  if (relation.isManyToMany && joinColumn) {
    const parentColumn = `joined.${joinColumn}`;
    return {
      parentColumn,
      query: manager
        .createQueryBuilder()
        .from(targetTable, "self")
        .select("self.id")
        .addSelect("self.version")
        .addSelect(`${parentColumn} as __parent`)
        .innerJoin(
          joinTable,
          "joined",
          `joined.${joinColumn} IN (:...__parents) AND joined.${inverseJoinColumn} = self.id`,
        ),
    };
  }

  // non-owning side many-to-many
  if (relation.isManyToMany && relation.inverseRelation && mappedBy) {
    const inverse = relation.inverseRelation;
    const joinTable = inverse.joinTableName;
    const inverseJoinColumn = inverse.inverseJoinColumns?.[0].databaseName;
    const parentColumn = `joined.${inverseJoinColumn}`;
    return {
      parentColumn,
      query: manager
        .createQueryBuilder()
        .from(targetTable, "self")
        .select("self.id")
        .addSelect("self.version")
        .addSelect(`${parentColumn} as __parent`)
        .innerJoin(
          joinTable,
          "joined",
          `joined.${mappedBy} = self.id AND joined.${inverseJoinColumn} IN (:...__parents)`,
        ),
    };
  }

  throw new Error(`Invalid relation: ${relation.propertyName}`);
};

export const createSelectQuery = <T extends Entity>(
  builder: QueryBuilder<T>,
  options: ParseResult,
) => {
  const {
    select = {},
    where,
    params = {},
    joins = {},
    order,
    distinct,
  } = options;

  const allSelects: Record<string, string | undefined> = { ...select };

  builder.expressionMap.selects
    .filter((x) => x.selection !== "self")
    .forEach((x) => (allSelects[x.selection] = x.aliasName));

  const selections = Object.entries(allSelects);

  const sq =
    selections.length > 0
      ? builder.select("self.id").addSelect("self.version")
      : builder.select();

  selections
    .filter(([name]) => name !== "self.id" && name !== "self.version")
    .forEach(([name, alias]) => sq.addSelect(name, alias));

  Object.entries(joins).forEach(([name, alias]) => sq.leftJoin(name, alias));

  if (distinct) {
    sq.distinct(true);
  }

  if (where) sq.andWhere(where, params);
  if (order) sq.orderBy(toSqlOrder(order));

  return sq;
};

// select maps expressions to their aliases; this is the reverse lookup, for
// places that must reference the expression itself (e.g. inside a subquery)
export const selectExpressionByAlias = (
  select: Record<string, string>,
): Record<string, string> =>
  Object.entries(select).reduce(
    (prev, [expression, alias]) => ({ ...prev, [alias]: expression }),
    {},
  );

/**
 * Whether every order key resolves to an expression that references only the
 * `self` alias. Order keys that reach through joins (or that cannot be
 * resolved) return false.
 */
export const orderReferencesOnlySelf = (options: ParseResult) => {
  const { order = {}, select = {} } = options;
  const expressionByAlias = selectExpressionByAlias(select);
  return Object.keys(order).every((key) => {
    const expression = expressionByAlias[key] ?? key;
    const aliases = Array.from(
      expression.matchAll(/\b([A-Za-z_]\w*)\.\w/g),
      (m) => m[1],
    );
    return aliases.length > 0 && aliases.every((alias) => alias === "self");
  });
};

/**
 * A nested take/skip promises per-record pagination of a collection, but the
 * related records are fetched with one batched query for the whole page of
 * parents — a plain LIMIT there would cap the combined batch. This builds a
 * filter on a ranked subquery instead: `row_number()` partitioned by the
 * parent ranks each parent's items by the nested ordering, and only the ids
 * inside the takeSkipBounds window survive. A negative take anchors the
 * window at the end of each list, using the partition's `count(*)` to find
 * the same clamped start as the in-memory rule. With `dedupe`, the ranking
 * runs over the distinct (parent, item, order values) tuples, so rows
 * multiplied by a collection join in the nested where are ranked once.
 */
export const nestedPaginationFilter = (
  manager: EntityManager,
  relation: RelationMetadata,
  options: ParseResult,
  take: number,
  skip: number,
  dedupe = false,
) => {
  const { where, params, joins, order = {}, select = {} } = options;

  const { query: rq, parentColumn } = relationQuery(manager, relation);

  const inner = createSelectQuery(rq, { where, params, joins });

  // a window ORDER BY cannot reference select aliases, so order keys that are
  // aliases (e.g. normalized ones) are mapped back to their expressions
  const expressionByAlias = selectExpressionByAlias(select);

  inner.select(parentColumn, "__parent").addSelect("self.id", "__item");
  if (dedupe) {
    inner.distinct(true);
  }

  const orderings: [string, OrderBy][] = Object.entries(order);
  const ranking = (
    orderings.length > 0 ? orderings : ([["self.id", "ASC"]] as const)
  )
    .map(([key, direction], i) => {
      inner.addSelect(expressionByAlias[key] ?? key, `__order${i}`);
      return `d.__order${i} ${sqlOrderText(direction)}`;
    })
    .join(", ");

  const partition = "PARTITION BY d.__parent";
  const rankedSelects = [
    "d.__parent",
    "d.__item",
    `ROW_NUMBER() OVER (${partition} ORDER BY ${ranking}) AS __rank`,
  ];

  const fromEnd = take < 0;
  if (fromEnd) {
    rankedSelects.push(`COUNT(*) OVER (${partition}) AS __total`);
  }
  const ranked = `SELECT ${rankedSelects.join(", ")} FROM (${inner.getQuery()}) d`;

  // the same [start, end) window as takeSkipBounds: ranks are 1-based, so
  // `rank > start` and `rank <= start + |take|`; for a negative take the
  // start counts back from the partition's total, clamped at the list start
  const start = fromEnd
    ? "GREATEST(0, w.__total - :__nestedSkip - :__nestedTake)"
    : ":__nestedSkip";
  const window = [`w.__rank > ${start}`];
  if (take !== 0) {
    window.push(`w.__rank <= ${start} + :__nestedTake`);
  }

  // The filter must match on the (parent, item) pair, not the item alone: a
  // many-to-many item shared by several parents can be inside one parent's
  // window and outside another's.
  return {
    condition: `(${parentColumn}, self.id) IN (SELECT w.__parent, w.__item FROM (${ranked}) w WHERE ${window.join(" AND ")})`,
    params: {
      ...inner.getParameters(),
      __nestedSkip: Math.max(0, skip),
      __nestedTake: Math.abs(take),
    },
  };
};

export const createBulkQuery = <T extends Entity>(
  client: QueryClient,
  repo: OrmRepository<T>,
  where?: WhereOptions<T>,
) => {
  const opts = parseQuery(client, repo, { where });
  const qb = repo.createQueryBuilder("self");
  const sq = createSelectQuery(qb, opts);
  return sq;
};
