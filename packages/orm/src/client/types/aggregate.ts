import type { BigDecimal } from "../fields/decimal";
import type { Entity, OrderBy } from "./base";
import type { NumericFilter } from "./filters";
import type { WhereArg, WhereOptions } from "./query";

// ============================================================================
// Aggregate Types
// ============================================================================

export type Numeric = number | bigint | BigDecimal;
export type Countable = string | number | boolean | Date | bigint | BigDecimal;

export type AggregateOperation =
  | "avg"
  | "sum"
  | "min"
  | "max"
  | "count"
  | "groupBy";
export type NumericOperation = "avg" | "sum";
export type CountableOperation = "min" | "max" | "count" | "groupBy";

type FieldType<T, K> = K extends keyof T
  ? T[K] extends undefined
    ? NonNullable<T[K]>
    : T[K]
  : never;

export type AggregateSelect<T extends Entity, Op extends AggregateOperation> = {
  [K in keyof T as NonNullable<T[K]> extends Array<infer U>
    ? U extends Entity
      ? K
      : never
    : NonNullable<T[K]> extends Entity
      ? K
      : Op extends "avg" | "sum"
        ? NonNullable<T[K]> extends Numeric
          ? K
          : never
        : Op extends "count" | "min" | "max" | "groupBy"
          ? NonNullable<T[K]> extends Countable
            ? K
            : never
          : never]?: NonNullable<T[K]> extends Array<infer U>
    ? U extends Entity
      ? AggregateSelect<U, Op>
      : never
    : NonNullable<T[K]> extends Entity
      ? AggregateSelect<NonNullable<T[K]>, Op>
      : true;
};

export type NumericSelect<T extends Entity> = AggregateSelect<T, "avg">;
export type CountableSelect<T extends Entity> = AggregateSelect<T, "min">;

export type FilterShapeFromSelection<S, T extends Entity> = {
  [K in keyof S as S[K] extends never ? never : K]?: S[K] extends true
    ? K extends keyof T
      ? WhereArg<FieldType<T, K>>
      : never
    : S[K] extends object
      ? K extends keyof T
        ? T[K] extends Array<infer U>
          ? U extends Entity
            ? FilterShapeFromSelection<S[K], U>
            : never
          : T[K] extends Entity
            ? FilterShapeFromSelection<S[K], T[K]>
            : never
        : never
      : never;
};

export type HavingArg = NumericFilter<number>;

type AggregateFieldOperation<
  T extends Entity,
  Op extends AggregateOperation,
> = {
  [K in keyof T]?: Op extends "groupBy"
    ? NonNullable<T[K]> extends Countable
      ? WhereArg<NonNullable<T[K]>>
      : NonNullable<T[K]> extends Array<infer U>
        ? U extends Entity
          ? AggregateFieldOperation<U, Op>
          : never
        : NonNullable<T[K]> extends Entity
          ? AggregateFieldOperation<NonNullable<T[K]>, Op>
          : never
    : Op extends NumericOperation
      ? NonNullable<T[K]> extends Numeric
        ? HavingArg
        : NonNullable<T[K]> extends Array<infer U>
          ? U extends Entity
            ? AggregateFieldOperation<U, Op>
            : never
          : NonNullable<T[K]> extends Entity
            ? AggregateFieldOperation<NonNullable<T[K]>, Op>
            : never
      : Op extends CountableOperation
        ? NonNullable<T[K]> extends Countable
          ? HavingArg
          : NonNullable<T[K]> extends Array<infer U>
            ? U extends Entity
              ? AggregateFieldOperation<U, Op>
              : never
            : NonNullable<T[K]> extends Entity
              ? AggregateFieldOperation<NonNullable<T[K]>, Op>
              : never
        : never;
};

export type AggregateHaving<T extends Entity> = {
  [Op in AggregateOperation]?: AggregateFieldOperation<T, Op>;
};

type AggregateOrderByOperation<
  T extends Entity,
  Op extends AggregateOperation,
> = {
  [K in keyof T]?: Op extends NumericOperation
    ? NonNullable<T[K]> extends Numeric
      ? OrderBy
      : NonNullable<T[K]> extends Array<infer U>
        ? U extends Entity
          ? AggregateOrderByOperation<U, Op>
          : never
        : NonNullable<T[K]> extends Entity
          ? AggregateOrderByOperation<NonNullable<T[K]>, Op>
          : never
    : Op extends CountableOperation
      ? NonNullable<T[K]> extends Countable
        ? OrderBy
        : NonNullable<T[K]> extends Array<infer U>
          ? U extends Entity
            ? AggregateOrderByOperation<U, Op>
            : never
          : NonNullable<T[K]> extends Entity
            ? AggregateOrderByOperation<NonNullable<T[K]>, Op>
            : never
      : never;
};

export type AggregateOrderBy<T extends Entity> = {
  [Op in AggregateOperation]?: AggregateOrderByOperation<T, Op>;
};

export type AggregateOptions<T extends Entity> = {
  avg?: AggregateSelect<T, "avg">;
  sum?: AggregateSelect<T, "sum">;
  min?: AggregateSelect<T, "min">;
  max?: AggregateSelect<T, "max">;
  count?: AggregateSelect<T, "count">;
  groupBy?: AggregateSelect<T, "groupBy">;
  orderBy?: AggregateOrderBy<T>;
  having?: AggregateHaving<T>;
  where?: WhereOptions<T>;
  take?: number;
  skip?: number;
};

export type OrderByFromSelection<S> = {
  [K in keyof S]?: S[K] extends true
    ? OrderBy
    : S[K] extends object
      ? OrderByFromSelection<S[K]>
      : never;
};

type AggregateResultType<T, Op extends AggregateOperation> = Op extends "count"
  ? number
  : Op extends "avg" | "sum"
    ? number
    : Op extends "min" | "max"
      ? T extends Date
        ? Date
        : T extends string
          ? string
          : T extends boolean
            ? boolean
            : number
      : Op extends "groupBy"
        ? T
        : never;

export type AggregateValue<T, S, Op extends AggregateOperation = "groupBy"> = {
  [K in keyof S]: S[K] extends true
    ? K extends keyof T
      ? AggregateResultType<NonNullable<T[K]>, Op>
      : never
    : S[K] extends object
      ? K extends keyof T
        ? NonNullable<T[K]> extends Array<infer U>
          ? U extends Entity
            ? AggregateValue<U, S[K], Op>
            : never
          : NonNullable<T[K]> extends Entity
            ? AggregateValue<NonNullable<T[K]>, S[K], Op>
            : never
        : never
      : never;
};

export type AggregateResult<T extends Entity, A extends AggregateOptions<T>> = {
  [K in keyof A as A[K] extends undefined
    ? never
    : K extends "where" | "having" | "orderBy" | "take" | "skip"
      ? never
      : K extends AggregateOperation
        ? K
        : never]: K extends AggregateOperation
    ? A[K] extends object
      ? AggregateValue<T, A[K], K>
      : never
    : never;
};

export type AggregatePayload<
  T extends Entity,
  A extends AggregateOptions<T>,
> = AggregateResult<T, A>;
