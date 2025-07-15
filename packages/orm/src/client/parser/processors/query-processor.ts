import { Repository } from "typeorm";
import { QueryClient, QueryOptions } from "../../types";
import { ParserContext } from "../context";
import { isPageQuery } from "../cursor";
import { JoinHandler } from "../handlers/join-handler";
import { JsonQueryHandler } from "../handlers/json-handler";
import { parseQuery } from "../parser";
import { ParseResult } from "../types";
import { OrderByProcessor } from "./order-processor";
import { SelectProcessor } from "./select-processor";
import { WhereProcessor } from "./where-processor";

export class QueryProcessor {
  private selectProcessor: SelectProcessor;
  private whereProcessor: WhereProcessor;
  private orderProcessor: OrderByProcessor;
  private jsonHandler: JsonQueryHandler;
  private joinHandler: JoinHandler;
  private context: ParserContext;

  constructor(private client: QueryClient) {
    this.context = new ParserContext(client);
    this.joinHandler = new JoinHandler(this.context);
    this.jsonHandler = new JsonQueryHandler(this.context);
    this.selectProcessor = new SelectProcessor(
      this.context,
      this.joinHandler
    );
    this.whereProcessor = new WhereProcessor(
      this.context,
      this.jsonHandler,
      this.joinHandler,
    );
    this.orderProcessor = new OrderByProcessor(
      this.context,
      this.jsonHandler,
      this.joinHandler,
    );
  }

  process(repo: Repository<any>, query: QueryOptions<any>): ParseResult {
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
      repo,
      selection,
      "self",
      this.client,
    );
    const whereResult = this.whereProcessor.process(repo, conditions, "self");
    const orderResult = this.orderProcessor.process(repo, orderBy, "self");

    // Handle pagination ordering
    let finalOrder = orderResult?.order || {};
    if (isPageQuery(query)) {
      const uniqueOrder = this.orderProcessor.ensureUniqueOrderBy(
        repo,
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

  static parse(
    client: QueryClient,
    repo: Repository<any>,
    query: QueryOptions<any>,
  ): ParseResult {
    return new QueryProcessor(client).process(repo, query);
  }
}
