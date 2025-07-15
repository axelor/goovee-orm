import { Repository } from "typeorm";
import { ParserContext } from "../context";
import { JoinHandler } from "../handlers/join-handler";
import { JsonQueryHandler } from "../handlers/json-handler";
import { AggregateOptions, ParseResult, QueryClient } from "../types";
import { WhereProcessor } from "./where-processor";

export class AggregateProcessor {
  private context: ParserContext;
  private whereProcessor: WhereProcessor;
  private joinHandler: JoinHandler;
  private jsonHandler: JsonQueryHandler;

  constructor(private client: QueryClient) {
    this.context = new ParserContext(client);
    this.joinHandler = new JoinHandler(this.context);
    this.jsonHandler = new JsonQueryHandler(this.context);
    this.whereProcessor = new WhereProcessor(
      this.context,
      this.jsonHandler,
      this.joinHandler,
    );
  }

  process(
    repo: Repository<any>,
    opts: AggregateOptions<any>,
  ): ParseResult {
    let select: Record<string, string> = {};
    let joins: Record<string, string> = {};
    let groups: Record<string, any> = {};
    let aliasMap: Record<string, string> = {};
    let having: string | undefined;
    let havingParams: Record<string, any> = {};

    const prefix = "self";
    const {
      _count,
      _avg,
      _sum,
      _min,
      _max,
      groupBy,
      where: conditions = {},
      orderBy = {},
      having: havingConditions,
      take,
      skip,
    } = opts;

    // Process where conditions (pre-aggregation filtering)
    const whereResult = this.whereProcessor.process(repo, conditions, prefix);

    // Process aggregate operations
    if (_count) {
      const countResult = this.processAggregateOperations(
        repo,
        _count,
        prefix,
        "COUNT",
        "_count",
      );
      select = { ...select, ...countResult.select };
      joins = { ...joins, ...countResult.joins };
      aliasMap = { ...aliasMap, ...countResult.aliasMap };
    }

    if (_avg) {
      const avgResult = this.processAggregateOperations(
        repo,
        _avg,
        prefix,
        "AVG",
        "_avg",
      );
      select = { ...select, ...avgResult.select };
      joins = { ...joins, ...avgResult.joins };
      aliasMap = { ...aliasMap, ...avgResult.aliasMap };
    }

    if (_sum) {
      const sumResult = this.processAggregateOperations(
        repo,
        _sum,
        prefix,
        "SUM",
        "_sum",
      );
      select = { ...select, ...sumResult.select };
      joins = { ...joins, ...sumResult.joins };
      aliasMap = { ...aliasMap, ...sumResult.aliasMap };
    }

    if (_min) {
      const minResult = this.processAggregateOperations(
        repo,
        _min,
        prefix,
        "MIN",
        "_min",
      );
      select = { ...select, ...minResult.select };
      joins = { ...joins, ...minResult.joins };
      aliasMap = { ...aliasMap, ...minResult.aliasMap };
    }

    if (_max) {
      const maxResult = this.processAggregateOperations(
        repo,
        _max,
        prefix,
        "MAX",
        "_max",
      );
      select = { ...select, ...maxResult.select };
      joins = { ...joins, ...maxResult.joins };
      aliasMap = { ...aliasMap, ...maxResult.aliasMap };
    }

    // Process groupBy fields
    if (groupBy) {
      const groupResult = this.processGroupByFields(
        repo,
        groupBy,
        prefix,
        "groupBy",
      );
      select = { ...select, ...groupResult.select };
      joins = { ...joins, ...groupResult.joins };
      groups = { ...groups, ...groupResult.groups };
      aliasMap = { ...aliasMap, ...groupResult.aliasMap };
    }

    // Process having conditions (post-aggregation filtering)
    if (havingConditions) {
      const havingResult = this.processHavingConditions(
        repo,
        havingConditions,
        prefix,
      );
      having = havingResult.having;
      havingParams = { ...havingParams, ...havingResult.params };
      joins = { ...joins, ...havingResult.joins };
    }

    // Combine all joins and sort them
    const allJoins = {
      ...joins,
      ...(whereResult?.joins || {}),
    };
    const sortedJoins = this.context.sortJoins(allJoins);

    // Build final result
    const result: ParseResult = {
      select,
      joins: sortedJoins,
      where: whereResult?.where,
      groups: Object.keys(groups).length > 0 ? groups : undefined,
      having: having,
      params: { ...whereResult?.params, ...havingParams },
      aliasMap: Object.keys(aliasMap).length > 0 ? aliasMap : undefined,
      take,
      skip,
    };

    return this.cleanResult(result);
  }

  private processAggregateOperations(
    repo: Repository<any>,
    aggregateOpts: any,
    prefix: string,
    operation: string,
    basePath: string,
  ): {
    select: Record<string, string>;
    joins: Record<string, string>;
    aliasMap: Record<string, string>;
  } {
    const select: Record<string, string> = {};
    const joins: Record<string, string> = {};
    const aliasMap: Record<string, string> = {};

    for (const [fieldName, value] of Object.entries(aggregateOpts)) {
      const currentPath =
        basePath === "groupBy" ? fieldName : `${basePath}.${fieldName}`;

      if (value === true) {
        const name = this.context.makeName(prefix, fieldName);
        const alias = this.context.makeAlias(repo, prefix, fieldName);

        // Check if it's a relation
        const relation = repo.metadata.findRelationWithPropertyPath(fieldName);
        if (relation) {
          joins[name] = alias;
          // For relations, use id field for COUNT, otherwise use the relation field itself
          if (operation === "COUNT") {
            const selectKey = `${operation}(${alias}.id)`;
            const selectAlias = this.generateUniqueAlias(
              operation.toLowerCase(),
              currentPath,
            );
            select[selectKey] = selectAlias;
            aliasMap[selectAlias] = currentPath;
          } else {
            // For other operations on relations, we might need to handle differently
            // For now, let's use id field
            const selectKey = `${operation}(${alias}.id)`;
            const selectAlias = this.generateUniqueAlias(
              operation.toLowerCase(),
              currentPath,
            );
            select[selectKey] = selectAlias;
            aliasMap[selectAlias] = currentPath;
          }
        } else {
          const selectKey = `${operation}(${name})`;
          const selectAlias = this.generateUniqueAlias(
            operation.toLowerCase(),
            currentPath,
          );
          select[selectKey] = selectAlias;
          aliasMap[selectAlias] = currentPath;
        }
      } else if (typeof value === "object" && value !== null) {
        // Handle nested aggregate operations for relations
        const relation = repo.metadata.findRelationWithPropertyPath(fieldName);
        if (relation) {
          const name = this.context.makeName(prefix, fieldName);
          const alias = this.context.makeAlias(repo, prefix, fieldName);
          const rRepo = this.joinHandler.getRelationRepository(repo, relation);
          const nestedResult = this.processAggregateOperations(
            rRepo,
            value,
            alias,
            operation,
            currentPath,
          );
          Object.assign(select, nestedResult.select);
          Object.assign(joins, nestedResult.joins);
          Object.assign(aliasMap, nestedResult.aliasMap);
          joins[name] = alias;
        }
      }
    }

    return { select, joins, aliasMap };
  }

  private processGroupByFields(
    repo: Repository<any>,
    groupByOpts: any,
    prefix: string,
    basePath: string,
  ): {
    select: Record<string, string>;
    joins: Record<string, string>;
    groups: Record<string, any>;
    aliasMap: Record<string, string>;
  } {
    const select: Record<string, string> = {};
    const joins: Record<string, string> = {};
    const groups: Record<string, any> = {};
    const aliasMap: Record<string, string> = {};

    for (const [fieldName, value] of Object.entries(groupByOpts)) {
      const currentPath = `${basePath}.${fieldName}`;

      if (value === true) {
        const name = this.context.makeName(prefix, fieldName);
        const alias = this.context.makeAlias(repo, prefix, fieldName);

        // Check if it's a relation
        const relation = repo.metadata.findRelationWithPropertyPath(fieldName);
        if (relation) {
          joins[name] = alias;
          // For relations in groupBy, typically we group by the id
          const selectAlias = this.generateUniqueAlias("groupby", currentPath);
          select[`${alias}.id`] = selectAlias;
          groups[`${alias}.id`] = selectAlias;
          aliasMap[selectAlias] = currentPath;
        } else {
          // For regular fields, group by the field itself
          const selectAlias = this.generateUniqueAlias("groupby", currentPath);
          select[name] = selectAlias;
          groups[name] = selectAlias;
          aliasMap[selectAlias] = currentPath;
        }
      } else if (typeof value === "object" && value !== null) {
        // Handle nested groupBy for relations
        const relation = repo.metadata.findRelationWithPropertyPath(fieldName);
        if (relation) {
          const name = this.context.makeName(prefix, fieldName);
          const alias = this.context.makeAlias(repo, prefix, fieldName);
          const rRepo = this.joinHandler.getRelationRepository(repo, relation);

          const nestedResult = this.processGroupByFields(
            rRepo,
            value,
            alias,
            currentPath,
          );
          Object.assign(select, nestedResult.select);
          Object.assign(joins, nestedResult.joins);
          Object.assign(groups, nestedResult.groups);
          Object.assign(aliasMap, nestedResult.aliasMap);
          joins[name] = alias;
        }
      }
    }

    return { select, joins, groups, aliasMap };
  }

  private processHavingConditions(
    repo: Repository<any>,
    havingOpts: any,
    prefix: string,
  ): {
    having: string;
    params: Record<string, any>;
    joins: Record<string, string>;
  } {
    let having = "";
    let params: Record<string, any> = {};
    let joins: Record<string, string> = {};

    const conditions: string[] = [];

    for (const [operation, fieldConditions] of Object.entries(havingOpts)) {
      if (typeof fieldConditions === "object" && fieldConditions !== null) {
        const result = this.processHavingFields(
          repo,
          fieldConditions,
          prefix,
          operation,
        );
        conditions.push(...result.conditions);
        Object.assign(params, result.params);
        Object.assign(joins, result.joins);
      }
    }

    if (conditions.length > 0) {
      having = conditions.join(" AND ");
    }

    return { having, params, joins };
  }

  private processHavingFields(
    repo: Repository<any>,
    fieldConditions: any,
    prefix: string,
    operation: string,
  ): {
    conditions: string[];
    params: Record<string, any>;
    joins: Record<string, string>;
  } {
    const conditions: string[] = [];
    let params: Record<string, any> = {};
    let joins: Record<string, string> = {};

    for (const [fieldName, condition] of Object.entries(fieldConditions)) {
      const relation = repo.metadata.findRelationWithPropertyPath(fieldName);

      if (
        relation &&
        typeof condition === "object" &&
        condition !== null &&
        !this.isFilterCondition(condition)
      ) {
        // This is a nested relation having condition
        const name = this.context.makeName(prefix, fieldName);
        const alias = this.context.makeAlias(repo, prefix, fieldName);
        const rRepo = this.joinHandler.getRelationRepository(repo, relation);

        const nestedResult = this.processHavingFields(
          rRepo,
          condition,
          alias,
          operation,
        );
        conditions.push(...nestedResult.conditions);
        Object.assign(params, nestedResult.params);
        Object.assign(joins, nestedResult.joins);
        joins[name] = alias;
      } else {
        // This is a direct field condition
        const name = this.context.makeName(prefix, fieldName);
        const alias = this.context.makeAlias(repo, prefix, fieldName);

        let aggregateField = name;
        if (relation) {
          joins[name] = alias;
          aggregateField = `${alias}.id`;
        }

        // Process the filter condition
        if (typeof condition === "object" && condition !== null) {
          for (const [operator, value] of Object.entries(condition)) {
            // Remove the underscore prefix from operation name for SQL
            const cleanOperation = operation.startsWith("_")
              ? operation.substring(1)
              : operation;
            const aggregateExpr = `${cleanOperation.toUpperCase()}(${aggregateField})`;
            const param = this.context.nextParam();
            const sqlOp = this.getSqlOperator(operator);

            conditions.push(`${aggregateExpr} ${sqlOp} :${param}`);
            params[param] = value;
          }
        }
      }
    }

    return { conditions, params, joins };
  }

  private isFilterCondition(obj: any): boolean {
    if (typeof obj !== "object" || obj === null) return false;
    const filterOps = [
      "eq",
      "ne",
      "gt",
      "ge",
      "lt",
      "le",
      "in",
      "notIn",
      "between",
      "notBetween",
    ];
    return Object.keys(obj).some((key) => filterOps.includes(key));
  }

  private generateUniqueAlias(operation: string, path: string): string {
    // Convert path like "_avg.addresses.country.version" to "avg_addresses_country_version"
    // or "groupBy.title.id" to "groupby_title_id"
    const cleanPath = path.replace(/^_/, "").replace(/\./g, "_");

    // Apply PostgreSQL NAMEDATALEN limit with uniqueness handling
    return this.context.truncateAlias(cleanPath);
  }

  private getSqlOperator(operator: string): string {
    const operators: Record<string, string> = {
      eq: "=",
      ne: "!=",
      gt: ">",
      ge: ">=",
      lt: "<",
      le: "<=",
    };
    return operators[operator] || "=";
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

  static parse(
    client: QueryClient,
    repo: Repository<any>,
    query: AggregateOptions<any>,
  ): ParseResult {
    return new AggregateProcessor(client).process(repo, query);
  }
}
