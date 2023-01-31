import { Repository } from "typeorm";
import {
  Entity,
  JsonOrder,
  JsonWhere,
  OrderBy,
  OrderByOptions,
  QueryOptions,
  SelectOptions,
  WhereOptions,
} from "./types";

export type ParseResult = {
  select?: Record<string, string>;
  joins?: Record<string, string>;
  order?: Record<string, OrderBy>;
  where?: string;
  params?: Record<string, any>;
  references?: Record<string, ParseResult>;
  collections?: Record<string, ParseResult>;
  take?: number;
  skip?: number;
  cursor?: string;
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
        if (relation.isOneToMany || relation.isManyToMany) {
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

  const jsonRegEx = /(?<path>[^:]+)::(?<type>.*)/;

  const isJson = (repo: Repository<any>, name: string) => {
    const column = repo.metadata.findColumnWithPropertyName(name);
    return column && column.type === "jsonb";
  };

  const makeJsonParams = (value: any, type: string) => {
    const arr = Array.isArray(value) ? value : [value];
    const params = arr.reduce((prev, v) => {
      const p = `p${counter++}`;
      return { ...prev, [p]: v };
    }, {});
    const args = Object.keys(params)
      .map((x) => `'${x}', cast(:${x} as ${type})`)
      .join(", ");
    const vars = `jsonb_build_object(${args})`;
    return {
      vars,
      params,
    };
  };

  const processJsonCondition = (op: string, value: any, type: string) => {
    let { vars, params } = makeJsonParams(value, type);
    let keys = Object.keys(params);

    let condition: string = "";
    if (op === "eq") condition = `@ == $${keys[0]}`;
    if (op === "ne") condition = `@ != $${keys[0]}`;
    if (op === "gt") condition = `@ > $${keys[0]}`;
    if (op === "ge") condition = `@ >= $${keys[0]}`;
    if (op === "lt") condition = `@ < $${keys[0]}`;
    if (op === "le") condition = `@ <= $${keys[0]}`;

    if (op === "like" || op == "notLike") {
      const p = keys[0];
      const v = params[p];
      params[p] = v.replace(/%/g, ".*");
      condition = `@ like_regex "^' || :${p} || '$" flag "i"`;
      vars = "";
    }

    if (op === "in" || op === "notIn") {
      condition = keys.map((x) => `@ == $${x}`).join(" || ");
    }

    if (op === "between" || op === "notBetween") {
      condition = `@ >= $${keys[0]} && @ <= $${keys[1]}`;
    }

    if (type === "decimal") {
      condition = condition.replace("@", "@.double()");
    }
    if (type === "datetime") {
      condition = condition.replace("@", "@.datetime()");
    }

    if (op.startsWith("not")) condition = `!(${condition})`;

    return {
      condition,
      vars,
      params,
    };
  };

  const processJsonWhere = (opts: JsonWhere, prefix: string) => {
    const where: any[] = [];
    for (const [key, arg] of Object.entries(opts)) {
      if (["OR", "AND", "NOT"].includes(key)) {
        const joiner = key === "OR" ? "OR" : "AND";
        const wrap = key === "NOT" ? "NOT" : "";
        if (Array.isArray(arg)) {
          const ws = arg.map((x) => processJsonWhere(x, prefix));
          const w = acceptWhereCauses(ws, joiner);
          w.where = `${wrap}(${w.where})`;
          where.push(w);
        }
        continue;
      }
      const match = jsonRegEx.exec(key);
      if (match && match.groups) {
        const path = match.groups.path;
        const type = match.groups.type;
        for (const [op, value] of Object.entries(arg as any)) {
          const { condition, vars, params } = processJsonCondition(
            op,
            value,
            type
          );
          const expr = vars
            ? `jsonb_path_exists(${prefix}, '$.${path} ? (${condition})', ${vars})`
            : `jsonb_path_exists(${prefix}, cast('$.${path} ? (${condition})' as jsonpath))`;
          const w = { where: expr, params };
          where.push(w);
        }
      }
    }
    return acceptWhereCauses(where);
  };

  const processWhere = (
    repo: Repository<any>,
    opts: WhereOptions<T>,
    prefix: string
  ) => {
    const where: any[] = [];
    for (const [key, value] of Object.entries(opts)) {
      if (key === "OR" || key === "AND" || key === "NOT") {
        const joiner = key === "OR" ? "OR" : "AND";
        const wrap = key === "NOT" ? "NOT" : "";
        if (Array.isArray(value)) {
          const ws = value.map((x) => processWhere(repo, x, prefix));
          const w = acceptWhereCauses(ws, joiner);
          w.where = `${wrap}(${w.where})`;
          where.push(w);
        }
        continue;
      }

      const name = makeName(prefix, key);
      const alias = makeAlias(prefix, key);

      if (isJson(repo, key)) {
        const w = processJsonWhere(value, name);
        where.push(w);
        continue;
      }

      const relation = repo.metadata.findRelationWithPropertyPath(key);
      if (relation) {
        const rRepo: any = repo.manager.getRepository(relation.type);
        const w = processWhere(rRepo, value, alias);
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

  const processOrderByJson = (opts: JsonOrder, prefix: string) => {
    const order: Record<string, any> = {};
    for (const [key, value] of Object.entries(opts)) {
      const match = jsonRegEx.exec(key);
      if (match && match.groups) {
        const path = match.groups.path.split(/\./g).map((x) => `'${x}'`);
        const type = match.groups.type;
        const args = path.join(", ");
        const expr = `cast(jsonb_extract_path_text(${prefix}, ${args}) as ${type})`;
        order[expr] = value;
      }
    }
    return order;
  };

  const processOrderBy = (
    repo: Repository<any>,
    opts: OrderByOptions<T>,
    prefix: string
  ) => {
    let order: Record<string, any> = {};
    let joins: Record<string, string> = {};
    let select: Record<string, any> = {};

    for (const [key, value] of Object.entries(opts)) {
      const name = makeName(prefix, key);
      const relation = repo.metadata.findRelationWithPropertyPath(key);
      if (relation) {
        const rRepo: any = repo.manager.getRepository(relation.type);
        const alias = makeAlias(prefix, key);
        const res = processOrderBy(rRepo, value as OrderByOptions<any>, alias);
        joins = { [name]: alias, ...joins, ...res.joins };
        order = { ...order, ...res.order };
        select = { ...select, ...res.select };
      } else if (isJson(repo, key)) {
        const jsonOrder = processOrderByJson(value as JsonOrder, name);
        Object.assign(order, jsonOrder);
      } else {
        select[name] = makeAlias(prefix, key);
        order[name] = value;
      }
    }
    return { order, joins, select };
  };

  const isNonNullUnique = (repo: Repository<any>, name: string) => {
    const column = repo.metadata.findColumnWithPropertyName(name);
    if (column?.isPrimary) return true;
    if (column?.isNullable) return false;
    return (
      column &&
      repo.metadata.uniques.some((x) => {
        x.columns.length === 1 &&
          x.columns[0].databaseName === column.databaseName;
      })
    );
  };

  const ensureUniqueOrderBy = (
    repo: Repository<any>,
    opts: OrderByOptions<T>
  ) => {
    return Object.keys(opts).some((name) => isNonNullUnique(repo, name))
      ? {}
      : { "self.id": "ASC" };
  };

  const {
    select: selection = {},
    where: conditions = {},
    orderBy = {},
  } = query;

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
  } = processWhere(repo, conditions, "self") ?? {};

  const {
    order,
    joins: orderJoins,
    select: orderSelect,
  } = processOrderBy(repo, orderBy, "self") ?? {};

  const { take, skip, cursor } = query;

  // if pagination query, ensure ordering by an unique index
  if ((take && (take > 1 || take < -1)) || (skip && skip > 0)) {
    Object.assign(order, ensureUniqueOrderBy(repo, orderBy));
  }

  const result = {
    select: { ...select, ...orderSelect },
    joins: { ...selectJoins, ...whereJoins, ...orderJoins },
    where,
    order,
    params,
    references,
    collections,
    take,
    skip,
    cursor,
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

export type CursorTuple = [string, OrderBy, any];
export type Cursor = CursorTuple[];

export const encodeCursor = (cursor: Cursor) => {
  const json = JSON.stringify(cursor);
  const text = Buffer.from(json, "utf-8").toString("base64");
  return text;
};

export const decodeCursor = (cursor: string): Cursor => {
  const text = Buffer.from(cursor, "base64").toString("utf-8");
  const json = JSON.parse(text);
  return json;
};

const ID_SELECT: Record<string, string> = {
  "self.id": "self_id",
};

export const createCursor = (
  options: ParseResult,
  rawValues: Record<string, any>
) => {
  const { select = {}, order = {} } = options;
  const cur: Cursor = Object.keys(order).map((key) => {
    const n = select[key] ?? ID_SELECT[key];
    const o = order[key];
    const v = rawValues[n];
    return [key, o, v];
  }, {});

  return encodeCursor(cur);
};

const ORDER_OPS = {
  ASC: ">",
  DESC: "<",
};

const ORDER_OPS_INVERTED = {
  ASC: "<",
  DESC: ">",
};

const ORDER_INVERTED = {
  ASC: "DESC",
  DESC: "ASC",
};

export const parseCursor = (
  options: ParseResult
): Pick<ParseResult, "where" | "params" | "order"> => {
  const { take, cursor, order: orderBy = {} } = options;

  if (cursor === void 0) {
    return {};
  }

  const cur = decodeCursor(cursor);
  const orderChanged = cur.some(([k, o]) => orderBy[k] !== o);

  if (orderChanged) {
    return {};
  }

  let count = 0;

  const makeWhere = (items: CursorTuple[], invert: boolean) => {
    const [first, ...rest] = items;
    const [key, order, value] = first;

    let where: string;
    let params: Record<string, any> = {};

    const p = `q${count++}`;
    params[p] = value;

    const op = invert ? ORDER_OPS_INVERTED[order] : ORDER_OPS[order];

    if (rest && rest.length) {
      const next = makeWhere(rest, invert);
      if (rest.length > 1) next.where = `(${next.where})`;
      where = `${key} ${op} :${p} OR (${key} = :${p} AND ${next.where})`;
      params = { ...params, ...next.params };
    } else {
      where = `${key} ${op} :${p}`;
    }

    return { where, params };
  };

  const invert = (take ?? 0) < 0;
  const { where, params } = makeWhere(cur, invert);

  if (invert) {
    const order = Object.entries(orderBy).reduce(
      (prev, [k, o]) => ({ ...prev, [k]: ORDER_INVERTED[o] }),
      {}
    );
    return { where, params, order };
  }

  return { where, params };
};
