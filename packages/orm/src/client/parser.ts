import { Repository } from "typeorm";
import {
  Entity,
  JsonOrderBy,
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
  query: QueryOptions<T> = {},
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

  const makeAlias = (repo: Repository<any>, prefix: string, name: string) => {
    const col = repo.metadata.findColumnWithPropertyName(name);
    const alt = col?.databaseName ?? name;
    const p = prefix.replace(/^[_]+/, "");
    const a = `${p}_${alt}`;
    return a;
  };

  let counter = 0;

  const makeWhere = (name: string, arg: any) => {
    const result: any = {
      where: "",
      params: {},
    };

    if (arg === null || typeof arg !== "object") {
      arg = { eq: arg };
    }

    for (const [key, value] of Object.entries(arg)) {
      if (value === null && (key === "eq" || key === "ne")) {
        result.where = key === "eq" ? `${name} IS NULL` : `${name} NOT NULL`;
        continue;
      }

      let op = "=";

      if (key === "eq") op = "=";
      if (key === "ne") op = "!=";

      if (key === "gt") op = ">";
      if (key === "ge") op = ">=";

      if (key === "lt") op = "<";
      if (key === "le") op = "<=";

      if (key === "like") op = "ILIKE";
      if (key === "notLike") op = "NOT ILIKE";

      const param = `p${counter++}`;

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

  const simpleSelect = (repo: Repository<any>) => {
    const meta = repo.metadata;
    const select = meta.columns
      .filter((x) => !meta.findRelationWithPropertyPath(x.propertyName))
      .filter((x) => !["oid", "text", "jsonb"].includes(x.type as any))
      .map((x) => x.propertyName)
      .reduce((prev, name) => ({ ...prev, [name]: true }), {});
    return select;
  };

  const processSelect = (
    repo: Repository<any>,
    opts: SelectOptions<T>,
    prefix: string,
  ) => {
    let select: Record<string, any> = {};
    let collections: Record<string, any> = {};
    let references: Record<string, any> = {};
    let joins: Record<string, string> = {};

    // if no selection is give, select all simple fields
    if (Object.keys(opts).length === 0) {
      opts = simpleSelect(repo);
    }

    for (const [key, value] of Object.entries(opts)) {
      const name = makeName(prefix, key);
      const alias = makeAlias(repo, prefix, key);
      const relation = repo.metadata.findRelationWithPropertyPath(key);
      if (relation) {
        const rRepo: any = repo.manager.getRepository(relation.type);
        if (value === true && (relation.isOneToOne || relation.isManyToOne)) {
          const nested = processSelect(rRepo, simpleSelect(rRepo), alias);
          Object.assign(select, nested.select);
          joins[name] = alias;
          continue;
        }
        if (relation.isOneToMany || relation.isManyToMany) {
          const v = value === true ? { select: simpleSelect(rRepo) } : value;
          const vResult = parseQuery(rRepo, v);
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

  const isJson = (repo: Repository<any>, name: string) => {
    const column = repo.metadata.findColumnWithPropertyName(name);
    return column && column.type === "jsonb";
  };

  const jsonCastTypes = {
    String: "text",
    Int: "integer",
    Boolean: "boolean",
    Decimal: "decimal",
    Date: "timestamp",
  } as const;

  const findJsonType = (value: any) => {
    if (Array.isArray(value)) value = value[0];
    if (typeof value === "number") return "Int";
    if (typeof value === "boolean") return "Boolean";
    if (/^(-)?(\d+)(\.\d+)?$/.test(value)) return "Decimal";
    if (/^(\d{4})-(\d{2})-(\d{2}).*$/.test(value)) return "Date";
    return "String";
  };

  const findJsonCastType = (type?: keyof typeof jsonCastTypes) => {
    return jsonCastTypes[type ?? "String"];
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

    let { path, ...rest } = opts;
    let op;
    let value;

    // only first condition is considered
    for ([op, value] of Object.entries(rest)) break;

    if (op === undefined) {
      throw new Error(`Invalid JSON filter: ${JSON.stringify(opts)}`);
    }

    const type = findJsonCastType(opts.type ?? findJsonType(value));
    const { condition, vars, params } = processJsonCondition(op, value, type);
    const expr = vars
      ? `jsonb_path_exists(${prefix}, '$.${path} ? (${condition})', ${vars})`
      : `jsonb_path_exists(${prefix}, cast('$.${path} ? (${condition})' as jsonpath))`;

    const w = { where: expr, params };
    where.push(w);

    return acceptWhereCauses(where);
  };

  const processWhere = (
    repo: Repository<any>,
    opts: WhereOptions<T>,
    prefix: string,
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
      const alias = makeAlias(repo, prefix, key);

      if (isJson(repo, key)) {
        const w = processJsonWhere(value, name);
        where.push(w);
        continue;
      }

      const relation = repo.metadata.findRelationWithPropertyPath(key);
      if (relation) {
        // is null
        if (value?.id === null || value?.id?.eq === null) {
          where.push({ where: `${name} IS NULL` });
          continue;
        }
        // not null
        if (value?.id?.ne === null) {
          where.push({ where: `${name} NOT NULL` });
          continue;
        }
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

  const processOrderByJson = (opts: JsonOrderBy, prefix: string) => {
    const order: Record<string, any> = {};
    for (const opt of opts) {
      const path = opt.path.split(/\./g).map((x) => `'${x}'`);
      const args = path.join(", ");
      const type = findJsonCastType(opt.type);
      const expr = `cast(jsonb_extract_path_text(${prefix}, ${args}) as ${type})`;
      order[expr] = opt.order;
    }
    return order;
  };

  const processOrderBy = (
    repo: Repository<any>,
    opts: OrderByOptions<T>,
    prefix: string,
  ) => {
    let order: Record<string, any> = {};
    let joins: Record<string, string> = {};
    let select: Record<string, any> = {};

    for (const [key, value] of Object.entries(opts)) {
      const name = makeName(prefix, key);
      const relation = repo.metadata.findRelationWithPropertyPath(key);
      if (relation) {
        const rRepo: any = repo.manager.getRepository(relation.type);
        const alias = makeAlias(repo, prefix, key);
        const res = processOrderBy(rRepo, value as OrderByOptions<any>, alias);
        joins = { [name]: alias, ...joins, ...res.joins };
        order = { ...order, ...res.order };
        select = { ...select, ...res.select };
      } else if (isJson(repo, key)) {
        const jsonOrder = processOrderByJson(value as JsonOrderBy, name);
        Object.assign(order, jsonOrder);
      } else {
        select[name] = makeAlias(repo, prefix, key);
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
    opts: OrderByOptions<T>,
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
  } = processSelect(repo, selection, "self");

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
  if (isPageQuery(query)) {
    Object.assign(order, ensureUniqueOrderBy(repo, orderBy));
  }

  // make sure nested joins are ordered else query builder will throw join not found error
  // e.g `join_table` should come before `join_table.nested`
  const allJoins = { ...selectJoins, ...whereJoins, ...orderJoins };
  const joins = Object.fromEntries(
    Object.entries(allJoins).sort((a, b) => {
      const a1 = a[1] as string;
      const b1 = b[1] as string;
      if (a1 === b1) return 0;
      if (a1.startsWith(b1)) return 1;
      if (b1.startsWith(a1)) return -1;
      return 0;
    })
  );

  const result = {
    select: { ...select, ...orderSelect },
    joins,
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
    }),
  );
};

export const isPageQuery = (options: QueryOptions<any> | ParseResult) => {
  const { take, skip } = options;
  return (take && skip) || (take && skip === void 0);
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
  rawValues: Record<string, any>,
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
  options: ParseResult,
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
      {},
    );
    return { where, params, order };
  }

  return { where, params };
};
