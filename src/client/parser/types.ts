import { Repository } from "typeorm";
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
} from "../types";

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
  aliasMap?: Record<string, string>;
  take?: number;
  skip?: number;
  cursor?: string;
  distinct?: boolean;
};

export type CursorTuple = [string, OrderBy, any];
export type Cursor = CursorTuple[];

export interface ProcessResult {
  select: Record<string, string>;
  joins: Record<string, string>;
  references: Record<string, ParseResult>;
  collections: Record<string, ParseResult>;
}

export interface WhereResult {
  where: string;
  params: Record<string, any>;
  joins: Record<string, string>;
}

export interface OrderResult {
  order: Record<string, OrderBy>;
  joins: Record<string, string>;
  select: Record<string, string>;
}

export const SQL_OPERATORS = {
  eq: "=",
  ne: "!=",
  gt: ">",
  ge: ">=",
  lt: "<",
  le: "<=",
  like: "LIKE",
  notLike: "NOT LIKE",
} as const;

export const JSON_CAST_TYPES = {
  String: "text",
  Int: "integer",
  Boolean: "boolean",
  Decimal: "decimal",
  Date: "timestamp",
} as const;

export const ORDER_OPS = {
  ASC: ">",
  DESC: "<",
} as const;

export const ORDER_OPS_INVERTED = {
  ASC: "<",
  DESC: ">",
} as const;

export const ORDER_INVERTED = {
  ASC: "DESC",
  DESC: "ASC",
} as const;

export const ID_SELECT: Record<string, string> = {
  "self.id": "self_id",
};

// Re-export types from parent module for convenience
export type {
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
};
