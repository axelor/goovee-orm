import {
  ParseResult,
  Cursor,
  CursorTuple,
  QueryOptions,
  ORDER_OPS,
  ORDER_OPS_INVERTED,
  ORDER_INVERTED,
  ID_SELECT,
  WhereResult,
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

  const invert = (take ?? 0) < 0;
  let count = 0;

  const makeWhere = (items: CursorTuple[]): WhereResult => {
    const [first, ...rest] = items;
    const [key, order, value] = first;

    let where: string;
    let params: Record<string, any> = {};

    const p = `q${count++}`;
    params[p] = value;

    const op = invert ? ORDER_OPS_INVERTED[order] : ORDER_OPS[order];
    const isAsc = order.startsWith("ASC");
    const nullsFirst = order.includes("NULLS_FIRST");
    const nullsLast = order.includes("NULLS_LAST");

    // Forward direction: where do NULLs sit?
    // Explicit NULLS_FIRST/LAST wins; otherwise fall back to the DB
    // (Postgres) default: ASC -> NULLS LAST, DESC -> NULLS FIRST.
    let effectiveNullsFirst: boolean;
    if (nullsFirst) effectiveNullsFirst = true;
    else if (nullsLast) effectiveNullsFirst = false;
    else effectiveNullsFirst = !isAsc;

    if (invert) effectiveNullsFirst = !effectiveNullsFirst;

    let comp: string;
    if (value === null) {
      // NULL at the start of our direction -> everything non-null is after it.
      // NULL at the end -> nothing is after it.
      comp = effectiveNullsFirst ? `${key} IS NOT NULL` : "FALSE";
    } else if (!effectiveNullsFirst) {
      // NULLs sit on the "after" side, so pull trailing NULL rows in too.
      comp = `(${key} ${op} :${p} OR ${key} IS NULL)`;
    } else {
      comp = `${key} ${op} :${p}`;
    }

    const eq = `${key} IS NOT DISTINCT FROM :${p}`;

    if (rest && rest.length) {
      const next = makeWhere(rest);
      if (rest.length > 1 && next.where) next.where = `(${next.where})`;
      where = `${comp} OR (${eq} AND ${next.where})`;
      params = { ...params, ...next.params };
    } else {
      where = comp;
    }

    return { where, params, joins: {} };
  };

  const { where, params } = makeWhere(cur);

  if (invert) {
    const order = Object.entries(orderBy).reduce(
      (prev, [k, o]) => ({ ...prev, [k]: ORDER_INVERTED[o] }),
      {},
    );
    return { where, params, order };
  }

  return { where, params };
}
