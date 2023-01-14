import { Repository } from "typeorm";
import { Entity, QueryOptions, SelectOptions, WhereOptions } from "./types";

export type ParseResult = {
  select?: Record<string, string>;
  joins?: Record<string, string>;
  where?: string;
  params?: Record<string, any>;
  references?: Record<string, ParseResult>;
  collections?: Record<string, ParseResult>;
  take?: string | number | bigint;
  skip?: string | number | bigint;
  cursor?: string | number | bigint;
};

export const parseQuery = <T extends Entity>(
  repo: Repository<any>,
  query: QueryOptions<T> = {}
): ParseResult => {
  const opAttrs = [
    "eq",
    "ne",
    "gt",
    "ge",
    "lt",
    "le",
    "like",
    "in",
    "between",
    "notLike",
    "notIn",
    "notBetween",
  ];
  const collectionAttrs = ["select", "where", "take", "skip"];

  const isJoin = (opts: any) => {
    return (
      opts &&
      typeof opts === "object" &&
      Object.keys(opts).every((k) => !opAttrs.includes(k))
    );
  };

  const isCollectionSelect = (opts: any) => {
    return collectionAttrs.some((x) => x in opts);
  };

  const makeName = (prefix: string, name: string) => {
    return `${prefix}.${name}`;
  };

  const makeAlias = (prefix: string, name: string) => {
    const col = repo.metadata.findColumnWithPropertyName(name);
    const alt = col?.databaseName ?? name;
    const p = prefix.replace(/^[_]+/, "");
    const a = `${p}_${alt}`;
    return a;
  };

  let counter = 0;

  const makeWhere = (name: string, arg: any) => {
    const param = `p${counter++}`;
    const result: any = {
      where: "",
      params: {},
    };

    if (!arg || typeof arg !== "object") {
      result.where = `${name} = :${param}`;
      result.params = { [param]: arg };
      return result;
    }

    for (const [key, value] of Object.entries(arg)) {
      let op = "=";

      if (key === "eq") op = "=";
      if (key === "ne") op = "!=";

      if (key === "gt") op = ">";
      if (key === "ge") op = ">=";

      if (key === "lt") op = "<";
      if (key === "le") op = "<=";

      if (key === "like") op = "LIKE";
      if (key === "notLike") op = "NOT LIKE";

      result.where = `${name} ${op} :${param}`;
      result.params = { [param]: value };

      if (Array.isArray(value)) {
        if (key === "in" || key === "notIn") {
          op = key === "in" ? "IN" : "NOT IN";
          result.where = `${name} ${op} (:...${param})`;
        }
        if (key === "between" || key === "notBetween") {
          op = key === "between" ? "BETWEEN" : "NOT BETWEEN";
          const param2 = `p${counter++}`;
          result.where = `${name} ${op} :${param} AND :${param2}`;
          result.params = { [param]: value[0], [param2]: value[1] };
        }
      }
    }
    return result;
  };

  const processSelect = (opts: SelectOptions<T>, prefix: string) => {
    let select: Record<string, any> = {};
    let collections: Record<string, any> = {};
    let references: Record<string, any> = {};
    let joins: Record<string, string> = {};

    for (const [key, value] of Object.entries(opts)) {
      const name = makeName(prefix, key);
      const alias = makeAlias(prefix, key);
      const relation = repo.metadata.findRelationWithPropertyPath(key);
      if (relation) {
        if (value === true) {
          const names = relation.inverseEntityMetadata.columns
            .map((x) => x.propertyName)
            .reduce((prev, name) => ({ ...prev, [name]: true }), {});
          const nested = processSelect(names, alias);

          Object.assign(select, nested.select);
          joins[name] = alias;
          continue;
        }
        const rRepo: any = repo.manager.getRepository(relation.type);
        if (isCollectionSelect(value)) {
          const v: any = value;
          const vResult: any = parseQuery(rRepo, v);
          collections[key] = vResult;
        } else {
          const nested: any = parseQuery(rRepo, { select: value });
          references[key] = nested;
        }
      } else {
        select[name] = alias;
      }
    }
    return { select, joins, references, collections };
  };

  const acceptWhereCauses = (items: any[], joiner: string = "AND") => {
    const where = items.map((x: any) => x.where).join(` ${joiner} `);
    const params = items.reduce((prev, x) => ({ ...prev, ...x.params }), {});
    const joins = items.reduce((prev, x) => ({ ...prev, ...x.joins }), {});
    return { where, params, joins };
  };

  const processWhere = (opts: WhereOptions<T>, prefix: string) => {
    const where: any[] = [];
    for (const [key, value] of Object.entries(opts)) {
      if (key === "OR" || key === "AND" || key === "NOT") {
        const joiner = key === "OR" ? "OR" : "AND";
        const wrap = key === "NOT" ? "NOT" : "";
        if (Array.isArray(value)) {
          const ws = value.map((x) => processWhere(x, prefix));
          const w = acceptWhereCauses(ws, joiner);
          w.where = `${wrap}(${w.where})`;
          where.push(w);
        }
        continue;
      }

      const name = makeName(prefix, key);
      const alias = makeAlias(prefix, key);

      if (isJoin(value)) {
        const w = processWhere(value, alias);
        if (w) {
          w.joins[name] = alias;
          where.push(w);
        }
      } else {
        const w = makeWhere(name, value);
        where.push(w);
      }
    }

    if (where.length > 0) {
      return acceptWhereCauses(where);
    }
  };

  const { select: selection = {}, where: conditions = {} } = query;

  const {
    select,
    joins: selectJoins,
    references,
    collections,
  } = processSelect(selection, "self");

  const {
    where,
    params,
    joins: whereJoins,
  } = processWhere(conditions, "self") ?? {};

  const result = {
    select,
    joins: { ...selectJoins, ...whereJoins },
    where,
    params,
    references,
    collections,
  };

  return JSON.parse(
    JSON.stringify(result, (k, v) => {
      if (v === undefined || v === null) return v;
      if (Array.isArray(v) && v.length === 0) return;
      if (typeof v === "object" && Object.keys(v).length === 0) return;
      return v;
    })
  );
};
