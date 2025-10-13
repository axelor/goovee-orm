import { Repository } from "typeorm";
import { ParserError } from "./errors";
import { AggregateProcessor } from "./processors/aggregate-processor";
import { QueryProcessor } from "./processors/query-processor";
import {
  AggregateOptions,
  ParseResult,
  QueryClient,
  QueryOptions,
} from "./types";

export function parseQuery(
  client: QueryClient,
  repo: Repository<any>,
  query: QueryOptions<any>,
): ParseResult {
  try {
    return QueryProcessor.parse(client, repo, query);
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
  try {
    return AggregateProcessor.parse(client, repo, query);
  } catch (error) {
    if (error instanceof ParserError) {
      throw error;
    }
    throw new ParserError(
      `Failed to parse aggregate query: ${error instanceof Error ? error.message : String(error)}`,
      { query, repository: repo.metadata.targetName },
    );
  }
}
