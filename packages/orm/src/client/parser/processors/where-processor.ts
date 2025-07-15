import { Repository } from "typeorm";
import { ParserContext, acceptWhereCauses } from "../context";
import { JsonQueryHandler } from "../handlers/json-handler";
import { JoinHandler } from "../handlers/join-handler";
import { WhereResult, WhereOptions, SQL_OPERATORS } from "../types";

export class WhereProcessor {
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