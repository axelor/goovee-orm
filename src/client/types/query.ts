import type { BigDecimal } from "../fields/decimal";
import type {
  Binary,
  Entity,
  Json,
  JsonObject,
  OmitByType,
  OrderBy,
  ResultIdentity,
  Text,
} from "./base";
import type {
  BigIntFilter,
  BooleanFilter,
  DateFilter,
  DecimalFilter,
  IdFilter,
  IntFilter,
  JsonOrderBy,
  JsonWhere,
  StringFilter,
} from "./filters";

// ============================================================================
// Query Types
// ============================================================================

export type WhereArg<T> = T extends number
  ? IntFilter
  : T extends bigint
    ? BigIntFilter
    : T extends boolean
      ? BooleanFilter
      : T extends BigDecimal
        ? DecimalFilter
        : T extends string
          ? StringFilter
          : T extends Date
            ? DateFilter
            : T extends Array<infer P>
              ? P extends Entity
                ? WhereOptions<P>
                : never
              : T extends Entity
                ? WhereOptions<T>
                : T extends Promise<infer S>
                  ? S extends string
                    ? StringFilter
                    : S extends JsonObject
                      ? JsonWhere
                      : never
                  : never;

export type WhereOptions<T extends Entity> =
  | {
      -readonly [K in keyof T]?: K extends "id" ? IdFilter : WhereArg<T[K]>;
    }
  | LogicalOperators<T>;

type LogicalOperators<T extends Entity> = {
  OR?: WhereOptions<T>[];
  AND?: WhereOptions<T>[];
  NOT?: WhereOptions<T>[];
};

export type OrderByArg<T> = T extends
  | string
  | number
  | boolean
  | Date
  | BigDecimal
  ? OrderBy
  : T extends Array<infer P>
    ? P extends Entity
      ? OrderByOptions<P>
      : never
    : T extends Entity
      ? OrderByOptions<T>
      : T extends Promise<infer S>
        ? S extends JsonObject
          ? JsonOrderBy
          : never
        : never;

export type OrderByOptions<T extends Entity> = {
  [K in keyof OmitByType<T, Text | Binary | undefined>]?: OrderByArg<T[K]>;
};

export type QueryOptions<T extends Entity> = {
  select?: SelectOptions<T>;
  where?: WhereOptions<T>;
  orderBy?: OrderByOptions<T>;
  take?: number;
  skip?: number;
  cursor?: string;
  distinct?: boolean;
};

// ============================================================================
// Select Types
// ============================================================================

export type SelectArg<T> =
  T extends Array<infer P>
    ? P extends Entity
      ? QueryOptions<P>
      : boolean
    : T extends Entity
      ? SelectOptions<T>
      : boolean;

export type SelectOptions<T extends Entity> = {
  -readonly [K in keyof T]?: SelectArg<T[K]>;
};

export type SelectKeys<T, S> = Pick<
  T,
  {
    [K in keyof T]: K extends keyof S
      ? S[K] extends undefined | null | false
        ? never
        : K
      : never;
  }[keyof T]
>;

type PayloadSelect<T extends Entity, Select> = ResultIdentity<T> & {
  [K in keyof SelectKeys<T, Select>]-?: K extends keyof Select & keyof T
    ? PayloadSelectArg<T[K], Select[K]> | null | undefined
    : never;
};

type PayloadSelectArg<T, Arg> = Arg extends undefined | null | false
  ? never
  : Arg extends true
    ? T extends Array<infer A>
      ? A extends Entity
        ? ResultIdentity<A>[]
        : T
      : T extends Entity
        ? ResultIdentity<T>
        : T
    : T extends Array<infer A>
      ? Arg extends { select: infer Select; [key: string]: any }
        ? A extends Entity
          ? PayloadSelect<A, Select>[]
          : never
        : never
      : T extends Entity
        ? Arg extends object
          ? PayloadSelect<T, Arg>
          : never
        : T;

export type PayloadSimple<T extends Entity> = ResultIdentity<T> &
  OmitByType<T, Json | Text | Binary | Entity | Entity[] | undefined>;

export type PayloadArg<T extends Entity, Q> = Q extends { select: infer S }
  ? PayloadSelect<T, S>
  : PayloadSimple<T>;

export type Payload<T extends Entity, Q> = PayloadArg<T, Q> & {
  _count?: string;
  _cursor?: string;
  _hasNext?: boolean;
  _hasPrev?: boolean;
};
