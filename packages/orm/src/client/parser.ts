import { Repository } from "typeorm";
import { EntityOptions } from "../schema";
import {
  AggregateOptions,
  ClientFeatures,
  JsonOrderBy,
  JsonWhere,
  OrderBy,
  OrderByOptions,
  QueryClient,
  QueryOptions,
  SelectOptions,
  WhereOptions,
} from "./types";

export type ParseResult = {
  select?: Record<string, string>;
  joins?: Record<string, string>;
  order?: Record<string, OrderBy>;
  groups?: Record<string, any>;
  where?: string;
  having?: string;
  params?: Record<string, any>;
  references?: Record<string, ParseResult>;
  collections?: Record<string, ParseResult>;
  take?: number;
  skip?: number;
  cursor?: string;
};

export type CursorTuple = [string, OrderBy, any];
export type Cursor = CursorTuple[];

interface ProcessResult {
  select: Record<string, string>;
  joins: Record<string, string>;
  references: Record<string, ParseResult>;
  collections: Record<string, ParseResult>;
}

interface WhereResult {
  where: string;
  params: Record<string, any>;
  joins: Record<string, string>;
}

interface OrderResult {
  order: Record<string, OrderBy>;
  joins: Record<string, string>;
  select: Record<string, string>;
}

const SQL_OPERATORS = {
  eq: "=",
  ne: "!=",
  gt: ">",
  ge: ">=",
  lt: "<",
  le: "<=",
  like: "LIKE",
  notLike: "NOT LIKE",
} as const;

const JSON_CAST_TYPES = {
  String: "text",
  Int: "integer",
  Boolean: "boolean",
  Decimal: "decimal",
  Date: "timestamp",
} as const;

const ORDER_OPS = {
  ASC: ">",
  DESC: "<",
} as const;

const ORDER_OPS_INVERTED = {
  ASC: "<",
  DESC: ">",
} as const;

const ORDER_INVERTED = {
  ASC: "DESC",
  DESC: "ASC",
} as const;

const ID_SELECT: Record<string, string> = {
  "self.id": "self_id",
};

class ParserError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, any>,
  ) {
    super(message);
    this.name = "ParserError";
  }
}

class InvalidJsonFilterError extends ParserError {
  constructor(filter: any) {
    super(`Invalid JSON filter: ${JSON.stringify(filter)}`, { filter });
  }
}

function acceptWhereCauses(
  items: WhereResult[],
  joiner: string = "AND",
): WhereResult {
  const where = items.map((x) => x.where).join(` ${joiner} `);
  const params = items.reduce((prev, x) => ({ ...prev, ...x.params }), {});
  const joins = items.reduce((prev, x) => ({ ...prev, ...x.joins }), {});
  return { where, params, joins };
}

function findJsonType(value: any): keyof typeof JSON_CAST_TYPES {
  if (Array.isArray(value)) value = value[0];
  if (typeof value === "number") return "Int";
  if (typeof value === "boolean") return "Boolean";
  if (/^(-)?(\d+)(\.\d+)?$/.test(value)) return "Decimal";
  if (/^(\d{4})-(\d{2})-(\d{2}).*$/.test(value)) return "Date";
  return "String";
}

function findJsonCastType(type?: keyof typeof JSON_CAST_TYPES): string {
  return JSON_CAST_TYPES[type ?? "String"];
}

class ParserContext {
  private counter = 0;
  public readonly schema: EntityOptions[];
  public readonly features: ClientFeatures;

  constructor(client: QueryClient) {
    this.schema = (client as any).__schema;
    this.features = (client as any).__features ?? {};
  }

  nextParam(): string {
    return `p${this.counter++}`;
  }

  nextQuery(): string {
    return `q${this.counter++}`;
  }

  isStringField(repo: Repository<any>, name: string): boolean {
    if (!this.schema) return false;
    const schemaDef = this.schema.find(
      (x) => x.name === repo.metadata.targetName,
    );
    const fieldDef = schemaDef?.fields?.find((x) => x.name === name);
    return fieldDef?.type === "String";
  }

  makeName(prefix: string, name: string): string {
    return `${prefix}.${name}`;
  }

  makeAlias(repo: Repository<any>, prefix: string, name: string): string {
    const col = repo.metadata.findColumnWithPropertyName(name);
    const alt = col?.databaseName ?? name;
    const p = prefix.replace(/^[_]+/, "");
    const a = `${p}_${alt}`;
    return a;
  }

  normalize(
    repo: Repository<any>,
    fieldName: string,
    variable: string,
  ): string {
    const { normalization = {} } = this.features;
    const { lowerCase = false, unaccent = false } = normalization;

    // Only apply normalization to string fields
    if (!this.isStringField(repo, fieldName)) return variable;

    let res = variable;
    if (lowerCase) res = `lower(${res})`;
    if (unaccent) res = `unaccent(${res})`;
    return res;
  }

  isJson(repo: Repository<any>, name: string): boolean {
    const column = repo.metadata.findColumnWithPropertyName(name);
    return !!(column && column.type === "jsonb");
  }

  sortJoins(joins: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(joins).sort((a, b) => {
        const a1 = a[1] as string;
        const b1 = b[1] as string;
        if (a1 === b1) return 0;
        if (a1.startsWith(b1)) return 1;
        if (b1.startsWith(a1)) return -1;
        return 0;
      }),
    );
  }
}

class JoinHandler {
  constructor(private context: ParserContext) {}

  processRelationJoin(
    repo: Repository<any>,
    relation: any,
    key: string,
    prefix: string,
  ): { name: string; alias: string } {
    const name = this.context.makeName(prefix, key);
    const alias = this.context.makeAlias(repo, prefix, key);
    return { name, alias };
  }

  getRelationRepository(repo: Repository<any>, relation: any): Repository<any> {
    return repo.manager.getRepository(relation.type);
  }

  isToOneRelation(relation: any): boolean {
    return relation.isOneToOne || relation.isManyToOne;
  }

  isToManyRelation(relation: any): boolean {
    return relation.isOneToMany || relation.isManyToMany;
  }
}

class JsonQueryHandler {
  constructor(private context: ParserContext) {}

  processJsonWhere(opts: JsonWhere, prefix: string): WhereResult {
    const where: WhereResult[] = [];

    let { path, ...rest } = opts;
    let op: string | undefined;
    let value: any;

    // only first condition is considered
    for ([op, value] of Object.entries(rest)) break;

    if (op === undefined) {
      throw new InvalidJsonFilterError(opts);
    }

    const type = findJsonCastType(opts.type ?? findJsonType(value));
    const { condition, vars, params } = this.processJsonCondition(
      op,
      value,
      type,
    );
    const expr = vars
      ? `jsonb_path_exists(${prefix}, '$.${path} ? (${condition})', ${vars})`
      : `jsonb_path_exists(${prefix}, cast('$.${path} ? (${condition})' as jsonpath))`;

    const w: WhereResult = { where: expr, params, joins: {} };
    where.push(w);

    return acceptWhereCauses(where);
  }

  processJsonOrderBy(
    opts: JsonOrderBy,
    prefix: string,
  ): Record<string, OrderBy> {
    const order: Record<string, OrderBy> = {};
    for (const opt of opts) {
      const path = opt.path.split(/\./g).map((x) => `'${x}'`);
      const args = path.join(", ");
      const type = findJsonCastType(opt.type);
      const expr = `cast(jsonb_extract_path_text(${prefix}, ${args}) as ${type})`;
      order[expr] = opt.order;
    }
    return order;
  }

  private makeJsonParams(value: any, type: string) {
    const arr = Array.isArray(value) ? value : [value];
    const params = arr.reduce((prev, v) => {
      const p = this.context.nextParam();
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
  }

  private processJsonCondition(op: string, value: any, type: string) {
    let { vars, params } = this.makeJsonParams(value, type);
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
      const flags = this.context.features?.normalization?.lowerCase
        ? 'flag "i"'
        : "";
      params[p] = v.replace(/%/g, ".*");
      condition = `@ like_regex "^' || :${p} || '$" ${flags}`;
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
  }
}

class WhereProcessor {
  constructor(
    private context: ParserContext,
    private jsonHandler: JsonQueryHandler,
    private joinHandler: JoinHandler,
  ) {}

  process(
    repo: Repository<any>,
    opts: WhereOptions<any>,
    prefix: string,
  ): WhereResult | undefined {
    const where: WhereResult[] = [];

    for (const [key, value] of Object.entries(opts)) {
      if (key === "OR" || key === "AND" || key === "NOT") {
        const result = this.processLogicalOperator(key, value, repo, prefix);
        if (result) where.push(result);
        continue;
      }

      const name = this.context.makeName(prefix, key);
      const alias = this.context.makeAlias(repo, prefix, key);

      if (this.context.isJson(repo, key)) {
        const w = this.jsonHandler.processJsonWhere(value, name);
        where.push(w);
        continue;
      }

      const relation = repo.metadata.findRelationWithPropertyPath(key);
      if (relation) {
        const result = this.processRelationWhere(
          relation,
          value,
          name,
          alias,
          repo,
        );
        if (result) where.push(result);
      } else {
        const w = this.makeWhere(repo, key, name, value);
        where.push(w);
      }
    }

    if (where.length > 0) {
      return acceptWhereCauses(where);
    }
  }

  private processLogicalOperator(
    key: string,
    value: any,
    repo: Repository<any>,
    prefix: string,
  ): WhereResult | null {
    const joiner = key === "OR" ? "OR" : "AND";
    const wrap = key === "NOT" ? "NOT" : "";

    if (Array.isArray(value)) {
      const ws = value
        .map((x) => this.process(repo, x, prefix))
        .filter((x): x is WhereResult => !!x);
      if (ws.length === 0) return null;

      const w = acceptWhereCauses(ws, joiner);
      w.where = `${wrap}(${w.where})`;
      return w;
    }
    return null;
  }

  private processRelationWhere(
    relation: any,
    value: any,
    name: string,
    alias: string,
    repo: Repository<any>,
  ): WhereResult | null {
    // is null
    if (value?.id === null || value?.id?.eq === null) {
      return { where: `${name} IS NULL`, params: {}, joins: {} };
    }
    // not null
    if (value?.id?.ne === null) {
      return { where: `${name} IS NOT NULL`, params: {}, joins: {} };
    }

    const rRepo = this.joinHandler.getRelationRepository(repo, relation);
    const w = this.process(rRepo, value, alias);
    if (w) {
      w.joins = { ...w.joins, [name]: alias };
      return w;
    }
    return null;
  }

  private makeWhere(
    repo: Repository<any>,
    fieldName: string,
    name: string,
    arg: any,
  ): WhereResult {
    const conditions: string[] = [];
    const params: Record<string, any> = {};

    if (arg === null || typeof arg !== "object") {
      arg = { eq: arg };
    }

    for (const [key, value] of Object.entries(arg)) {
      if (value === null && (key === "eq" || key === "ne")) {
        conditions.push(
          key === "eq" ? `${name} IS NULL` : `${name} IS NOT NULL`,
        );
        continue;
      }

      const op = SQL_OPERATORS[key as keyof typeof SQL_OPERATORS] || "=";
      const wrappedName = this.context.normalize(repo, fieldName, name);

      if (Array.isArray(value)) {
        this.processArrayCondition(
          key,
          value,
          wrappedName,
          fieldName,
          repo,
          conditions,
          params,
        );
      } else {
        const param = this.context.nextParam();
        const wrappedParam = this.context.normalize(
          repo,
          fieldName,
          `:${param}`,
        );
        conditions.push(`${wrappedName} ${op} ${wrappedParam}`);
        params[param] = value;
      }
    }

    return {
      where:
        conditions.length > 1
          ? `(${conditions.join(" AND ")})`
          : conditions[0] || "",
      params,
      joins: {},
    };
  }

  private processArrayCondition(
    key: string,
    value: any[],
    wrappedName: string,
    fieldName: string,
    repo: Repository<any>,
    conditions: string[],
    params: Record<string, any>,
  ): void {
    if (key === "in" || key === "notIn") {
      const op = key === "in" ? "IN" : "NOT IN";
      const paramPlaceholders = value.map((v) => {
        const p = this.context.nextParam();
        params[p] = v;
        return this.context.normalize(repo, fieldName, `:${p}`);
      });
      conditions.push(`${wrappedName} ${op} (${paramPlaceholders.join(", ")})`);
    } else if (key === "between" || key === "notBetween") {
      const op = key === "between" ? "BETWEEN" : "NOT BETWEEN";
      const param1 = this.context.nextParam();
      const param2 = this.context.nextParam();
      const wrappedParam1 = this.context.normalize(
        repo,
        fieldName,
        `:${param1}`,
      );
      const wrappedParam2 = this.context.normalize(
        repo,
        fieldName,
        `:${param2}`,
      );
      conditions.push(
        `${wrappedName} ${op} ${wrappedParam1} AND ${wrappedParam2}`,
      );
      params[param1] = value[0];
      params[param2] = value[1];
    }
  }
}

class SelectProcessor {
  constructor(
    private context: ParserContext,
    private joinHandler: JoinHandler,
  ) {}

  process(
    repo: Repository<any>,
    opts: SelectOptions<any>,
    prefix: string,
    client: QueryClient,
  ): ProcessResult {
    let select: Record<string, string> = {};
    let collections: Record<string, ParseResult> = {};
    let references: Record<string, ParseResult> = {};
    let joins: Record<string, string> = {};

    // if no selection is given, select all simple fields
    const selection =
      Object.keys(opts).length === 0 ? this.getSimpleSelect(repo) : opts;

    for (const [key, value] of Object.entries(selection)) {
      const { name, alias } = this.joinHandler.processRelationJoin(
        repo,
        null,
        key,
        prefix,
      );
      const relation = repo.metadata.findRelationWithPropertyPath(key);

      if (relation) {
        const result = this.processRelation(
          relation,
          key,
          value,
          name,
          alias,
          repo,
          client,
        );
        select = { ...select, ...result.select };
        joins = { ...joins, ...result.joins };
        collections = { ...collections, ...result.collections };
        references = { ...references, ...result.references };
      } else {
        select[name] = alias;
      }
    }

    return { select, joins, references, collections };
  }

  private getSimpleSelect(repo: Repository<any>): Record<string, boolean> {
    const meta = repo.metadata;
    return meta.columns
      .filter((x) => !meta.findRelationWithPropertyPath(x.propertyName))
      .filter((x) => !["oid", "text", "jsonb"].includes(x.type as any))
      .map((x) => x.propertyName)
      .reduce((prev, name) => ({ ...prev, [name]: true }), {});
  }

  private processRelation(
    relation: any,
    key: string,
    value: any,
    name: string,
    alias: string,
    repo: Repository<any>,
    client: QueryClient,
  ): ProcessResult {
    const rRepo = this.joinHandler.getRelationRepository(repo, relation);
    const result: ProcessResult = {
      select: {},
      joins: {},
      references: {},
      collections: {},
    };

    if (value === true && this.joinHandler.isToOneRelation(relation)) {
      const nested = this.process(
        rRepo,
        this.getSimpleSelect(rRepo),
        alias,
        client,
      );
      result.select = { ...result.select, ...nested.select };
      result.joins[name] = alias;
      return result;
    }

    if (this.joinHandler.isToManyRelation(relation)) {
      const v =
        value === true ? { select: this.getSimpleSelect(rRepo) } : value;
      const vResult = parseQuery(client, rRepo, v);
      result.collections[key] = vResult;
    } else {
      const nested = parseQuery(client, rRepo, { select: value });
      result.references[key] = nested;
    }

    return result;
  }
}

class OrderByProcessor {
  constructor(
    private context: ParserContext,
    private jsonHandler: JsonQueryHandler,
    private joinHandler: JoinHandler,
  ) {}

  process(
    repo: Repository<any>,
    opts: OrderByOptions<any>,
    prefix: string,
  ): OrderResult {
    let order: Record<string, OrderBy> = {};
    let joins: Record<string, string> = {};
    let select: Record<string, string> = {};

    for (const [key, value] of Object.entries(opts)) {
      const name = this.context.makeName(prefix, key);
      const relation = repo.metadata.findRelationWithPropertyPath(key);

      if (relation) {
        const result = this.processRelationOrderBy(
          relation,
          value,
          key,
          name,
          prefix,
          repo,
        );
        joins = { ...joins, ...result.joins };
        order = { ...order, ...result.order };
        select = { ...select, ...result.select };
      } else if (this.context.isJson(repo, key)) {
        if (Array.isArray(value)) {
          const jsonOrder = this.jsonHandler.processJsonOrderBy(
            value as JsonOrderBy,
            name,
          );
          order = { ...order, ...jsonOrder };
        }
      } else {
        select[name] = this.context.makeAlias(repo, prefix, key);
        order[this.context.normalize(repo, key, name)] = value as OrderBy;
      }
    }

    return { order, joins, select };
  }

  private processRelationOrderBy(
    relation: any,
    value: any,
    key: string,
    name: string,
    prefix: string,
    repo: Repository<any>,
  ): OrderResult {
    const rRepo = this.joinHandler.getRelationRepository(repo, relation);
    const alias = this.context.makeAlias(repo, prefix, key);
    const res = this.process(rRepo, value as OrderByOptions<any>, alias);

    return {
      joins: { [name]: alias, ...res.joins },
      order: { ...res.order },
      select: { ...res.select },
    };
  }

  ensureUniqueOrderBy(
    repo: Repository<any>,
    opts: OrderByOptions<any>,
  ): Record<string, OrderBy> {
    const hasUniqueField = Object.keys(opts).some((name) =>
      this.isNonNullUnique(repo, name),
    );
    return hasUniqueField ? {} : { "self.id": "ASC" as OrderBy };
  }

  private isNonNullUnique(repo: Repository<any>, name: string): boolean {
    const column = repo.metadata.findColumnWithPropertyName(name);
    if (column?.isPrimary) return true;
    if (column?.isNullable) return false;
    return !!(
      column &&
      repo.metadata.uniques.some((x) => {
        return (
          x.columns.length === 1 &&
          x.columns[0].databaseName === column.databaseName
        );
      })
    );
  }
}

class QueryParser {
  private selectProcessor: SelectProcessor;
  private whereProcessor: WhereProcessor;
  private orderProcessor: OrderByProcessor;
  private jsonHandler: JsonQueryHandler;
  private joinHandler: JoinHandler;

  constructor(
    private client: QueryClient,
    private repo: Repository<any>,
    private context: ParserContext,
  ) {
    this.joinHandler = new JoinHandler(context);
    this.jsonHandler = new JsonQueryHandler(context);
    this.selectProcessor = new SelectProcessor(context, this.joinHandler);
    this.whereProcessor = new WhereProcessor(
      context,
      this.jsonHandler,
      this.joinHandler,
    );
    this.orderProcessor = new OrderByProcessor(
      context,
      this.jsonHandler,
      this.joinHandler,
    );
  }

  build(query: QueryOptions<any>): ParseResult {
    const {
      select: selection = {},
      where: conditions = {},
      orderBy = {},
      take,
      skip,
      cursor,
    } = query;

    // Process each component
    const selectResult = this.selectProcessor.process(
      this.repo,
      selection,
      "self",
      this.client,
    );
    const whereResult = this.whereProcessor.process(
      this.repo,
      conditions,
      "self",
    );
    const orderResult = this.orderProcessor.process(this.repo, orderBy, "self");

    // Handle pagination ordering
    let finalOrder = orderResult?.order || {};
    if (isPageQuery(query)) {
      const uniqueOrder = this.orderProcessor.ensureUniqueOrderBy(
        this.repo,
        orderBy,
      );
      finalOrder = { ...finalOrder, ...uniqueOrder };
    }

    // Combine all joins and sort them
    const allJoins = {
      ...selectResult.joins,
      ...(whereResult?.joins || {}),
      ...(orderResult?.joins || {}),
    };
    const sortedJoins = this.context.sortJoins(allJoins);

    // Build final result
    const result: ParseResult = {
      select: { ...selectResult.select, ...(orderResult?.select || {}) },
      joins: sortedJoins,
      where: whereResult?.where,
      order: finalOrder,
      params: whereResult?.params,
      references: selectResult.references,
      collections: selectResult.collections,
      take,
      skip,
      cursor,
    };

    // Clean up undefined/empty values
    return this.cleanResult(result);
  }

  private cleanResult(result: ParseResult): ParseResult {
    return JSON.parse(
      JSON.stringify(result, (k, v) => {
        if (v === undefined || v === null) return v;
        if (Array.isArray(v) && v.length === 0) return;
        if (typeof v === "object" && Object.keys(v).length === 0) return;
        return v;
      }),
    );
  }
}

export function parseQuery(
  client: QueryClient,
  repo: Repository<any>,
  query: QueryOptions<any>,
): ParseResult {
  const context = new ParserContext(client);
  const builder = new QueryParser(client, repo, context);

  try {
    return builder.build(query);
  } catch (error) {
    if (error instanceof ParserError) {
      throw error;
    }
    throw new ParserError(
      `Failed to parse query: ${error instanceof Error ? error.message : String(error)}`,
      { query, repository: repo.metadata.targetName },
    );
  }
}

export function parseAggregate(
  client: QueryClient,
  repo: Repository<any>,
  query: AggregateOptions<any>,
): ParseResult {
  throw new ParserError("Not implemented yet.");
}

export function isPageQuery(options: QueryOptions<any> | ParseResult): boolean {
  const { take, skip } = options;
  return !!(take && skip) || !!(take && skip === void 0);
}

export function encodeCursor(cursor: Cursor): string {
  const json = JSON.stringify(cursor);
  const text = Buffer.from(json, "utf-8").toString("base64");
  return text;
}

export function decodeCursor(cursor: string): Cursor {
  const text = Buffer.from(cursor, "base64").toString("utf-8");
  const json = JSON.parse(text);
  return json;
}

export function createCursor(
  options: ParseResult,
  rawValues: Record<string, any>,
): string {
  const { select = {}, order = {} } = options;
  const cur: Cursor = Object.keys(order).map((key) => {
    const n = select[key] ?? ID_SELECT[key];
    const o = order[key];
    const v = rawValues[n];
    return [key, o, v];
  });

  return encodeCursor(cur);
}

export function parseCursor(
  options: ParseResult,
): Pick<ParseResult, "where" | "params" | "order"> {
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

  const makeWhere = (items: CursorTuple[], invert: boolean): WhereResult => {
    const [first, ...rest] = items;
    const [key, order, value] = first;

    let where: string;
    let params: Record<string, any> = {};

    const p = `q${count++}`;
    params[p] = value;

    const op = invert ? ORDER_OPS_INVERTED[order] : ORDER_OPS[order];

    if (rest && rest.length) {
      const next = makeWhere(rest, invert);
      if (rest.length > 1 && next.where) next.where = `(${next.where})`;
      where = `${key} ${op} :${p} OR (${key} = :${p} AND ${next.where})`;
      params = { ...params, ...next.params };
    } else {
      where = `${key} ${op} :${p}`;
    }

    return { where, params, joins: {} };
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
}
