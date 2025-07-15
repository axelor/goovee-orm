import {
  ParserContext,
  findJsonCastType,
  findJsonType,
  acceptWhereCauses,
} from "../context";
import { JsonWhere, JsonOrderBy, OrderBy, WhereResult } from "../types";
import { InvalidJsonFilterError } from "../errors";

export class JsonQueryHandler {
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
