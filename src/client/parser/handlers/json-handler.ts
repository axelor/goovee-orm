import {
  ParserContext,
  findJsonCastType,
  findJsonType,
  acceptWhereCauses,
} from "../context";
import { JsonWhere, JsonOrderBy, OrderBy, WhereResult } from "../types";
import { InvalidJsonFilterError } from "../errors";

type JsonPathSegment =
  | { kind: "field"; value: string }
  | { kind: "index"; value: string }
  | { kind: "wildcard" };

function parseJsonPath(path: string): JsonPathSegment[] {
  const segments: JsonPathSegment[] = [];
  let index = 0;

  while (index < path.length) {
    const field = path.slice(index).match(/^[a-zA-Z_][a-zA-Z0-9_]*/)?.[0];
    if (!field) {
      throw new Error(`Invalid JSON path: ${path}`);
    }

    segments.push({ kind: "field", value: field });
    index += field.length;

    while (path[index] === "[") {
      const close = path.indexOf("]", index);
      if (close === -1) {
        throw new Error(`Invalid JSON path: ${path}`);
      }

      const token = path.slice(index + 1, close);
      if (token === "*") {
        segments.push({ kind: "wildcard" });
      } else if (/^\d+$/.test(token)) {
        segments.push({ kind: "index", value: token });
      } else {
        throw new Error(`Invalid JSON path: ${path}`);
      }

      index = close + 1;
    }

    if (index === path.length) {
      break;
    }

    if (path[index] !== ".") {
      throw new Error(`Invalid JSON path: ${path}`);
    }

    index += 1;
  }

  return segments;
}

function buildJsonPath(segments: JsonPathSegment[]): string {
  return segments.reduce((path, segment) => {
    if (segment.kind === "field") return `${path}.${segment.value}`;
    if (segment.kind === "index") return `${path}[${segment.value}]`;
    return `${path}[*]`;
  }, "$");
}

function buildJsonExtractArgs(
  segments: JsonPathSegment[],
  rawPath: string,
): string {
  const args = segments.map((segment) => {
    if (segment.kind === "wildcard") {
      throw new Error(`Invalid JSON path for orderBy: ${rawPath}`);
    }
    return `'${segment.value}'`;
  });

  return args.join(", ");
}

export class JsonQueryHandler {
  constructor(private context: ParserContext) {}

  processJsonWhere(opts: JsonWhere, prefix: string): WhereResult {
    const where: WhereResult[] = [];

    let { path, ...rest } = opts;
    const segments = parseJsonPath(path);
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
    const jsonPath = buildJsonPath(segments);
    const expr = vars
      ? `jsonb_path_exists(${prefix}, '${jsonPath} ? (${condition})', ${vars})`
      : `jsonb_path_exists(${prefix}, cast('${jsonPath} ? (${condition})' as jsonpath))`;

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
      const segments = parseJsonPath(opt.path);
      const args = buildJsonExtractArgs(segments, opt.path);
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
    const isLikeOperator = op === "like" || op === "notLike";

    let condition: string = "";
    if (op === "eq") condition = `@ == $${keys[0]}`;
    if (op === "ne") condition = `@ != $${keys[0]}`;
    if (op === "gt") condition = `@ > $${keys[0]}`;
    if (op === "ge") condition = `@ >= $${keys[0]}`;
    if (op === "lt") condition = `@ < $${keys[0]}`;
    if (op === "le") condition = `@ <= $${keys[0]}`;

    if (isLikeOperator) {
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

    if (!isLikeOperator && type === "decimal") {
      condition = condition.replace(/@/g, "@.double()");
      // JSONPath variables are emitted as $pN placeholders, so rewrite all of them symmetrically.
      condition = condition.replace(/\$(\w+)/g, "$$$1.double()");
    }
    if (
      !isLikeOperator &&
      (type === "datetime" || type === "Date" || type === "timestamp")
    ) {
      condition = condition.replace(/@/g, "@.datetime()");
      condition = condition.replace(/\$(\w+)/g, "$$$1.datetime()");
    }

    if (op.startsWith("not")) condition = `!(${condition})`;

    return {
      condition,
      vars,
      params,
    };
  }
}
