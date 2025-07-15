import { 
  ParseResult, 
  Cursor, 
  CursorTuple, 
  QueryOptions, 
  ORDER_OPS, 
  ORDER_OPS_INVERTED, 
  ORDER_INVERTED, 
  ID_SELECT,
  WhereResult 
} from "./types";

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