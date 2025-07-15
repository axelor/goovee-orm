import type { BigDecimal } from "../fields/decimal";
import type { ID, OrderBy } from "./base";

// ============================================================================
// Filter Types
// ============================================================================

// Basic filter operations
export type FilterOperation<T> = {
  eq?: T | null;
  ne?: T | null;
  gt?: T;
  ge?: T;
  lt?: T;
  le?: T;
  in?: T[];
  notIn?: T[];
  between?: [T, T];
  notBetween?: [T, T];
};

export type StringFilterOperation = FilterOperation<string> & {
  like?: string;
  notLike?: string;
};

// Typed filters
export type NumericFilter<T> = FilterOperation<T> | T | null;
export type StringFilter = StringFilterOperation | string | null;
export type BooleanFilter = FilterOperation<boolean> | boolean | null;

// Specific numeric filters
export type IntFilter = NumericFilter<number>;
export type BigIntFilter = NumericFilter<bigint>;
export type DecimalFilter = NumericFilter<
  string | number | bigint | BigDecimal
>;
export type DateFilter = NumericFilter<Date | string>;
export type IdFilter = NumericFilter<ID>;

// ============================================================================
// JSON Path Types
// ============================================================================

export type JsonPathType = "String" | "Int" | "Boolean" | "Decimal" | "Date";

export type JsonPathBase = {
  path: string;
  type?: JsonPathType;
};

export type JsonStringPath = JsonPathBase & {
  type?: "String";
};

export type JsonIntPath = JsonPathBase & {
  type?: "Int";
};

export type JsonBooleanPath = JsonPathBase & {
  type?: "Boolean";
};

export type JsonDecimalPath = JsonPathBase & {
  type?: "Decimal";
};

export type JsonDatePath = JsonPathBase & {
  type?: "Date";
};

export type JsonPath =
  | JsonStringPath
  | JsonIntPath
  | JsonBooleanPath
  | JsonDecimalPath
  | JsonDatePath;

// JSON filters with path support
export type JsonPathFilter<P extends JsonPathBase, F> = F extends object
  ? P & Partial<F>
  : never;

export type JsonStringFilter = JsonPathFilter<JsonStringPath, StringFilter>;
export type JsonIntFilter = JsonPathFilter<JsonIntPath, IntFilter>;
export type JsonBooleanFilter = JsonPathFilter<JsonBooleanPath, BooleanFilter>;
export type JsonDecimalFilter = JsonPathFilter<JsonDecimalPath, DecimalFilter>;
export type JsonDateFilter = JsonPathFilter<JsonDatePath, DateFilter>;

export type JsonFilter =
  | JsonStringFilter
  | JsonIntFilter
  | JsonBooleanFilter
  | JsonDecimalFilter
  | JsonDateFilter;

export type JsonWhere = JsonFilter;

export type JsonOrder = JsonPath & { order: OrderBy };

export type JsonOrderBy = JsonOrder[];
