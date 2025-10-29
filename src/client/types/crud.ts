import type { BigDecimal } from "../fields/decimal";
import type { Entity, ID, InputIdentity, OmitByType } from "./base";
import type { SelectOptions, WhereOptions } from "./query";

// ============================================================================
// Create/Update/Delete Types
// ============================================================================

interface NestedCreateArg<T extends Entity> {
  select?: WhereOptions<T>;
  create?: CreateArgs<T>;
}

interface NestedCreateManyArg<T extends Entity> {
  select?: WhereOptions<T> | WhereOptions<T>[];
  create?: CreateArgs<T> | CreateArgs<T>[];
}

type AllowNull<T> = T extends undefined ? T | null : T;

export type CreateArg<T> =
  T extends Array<infer P>
    ? P extends Entity
      ? NestedCreateManyArg<P>
      : T
    : T extends Entity
      ? NestedCreateArg<T>
      : T extends BigDecimal
        ? AllowNull<string | number | bigint | T>
        : AllowNull<T>;

export type CreateArgs<T extends Entity> = {
  [K in keyof T]: CreateArg<T[K]>;
};

export type CreateOptions<T extends Entity> = {
  data: CreateArgs<T>;
  select?: SelectOptions<T>;
};

type NestedUpdateArg<T extends Entity> = {
  select?: WhereOptions<T>;
  create?: CreateArgs<T>;
  update?: UpdateArgs<T>;
};

type NestedUpdateManyArg<T extends Entity> = {
  select?: WhereOptions<T> | WhereOptions<T>[];
  create?: CreateArgs<T> | CreateArgs<T>[];
  update?: UpdateArgs<T> | UpdateArgs<T>[];
  remove?: ID | ID[];
};

export type UpdateArg<T> =
  T extends Array<infer P>
    ? P extends Entity
      ? NestedUpdateManyArg<P>
      : T
    : T extends Entity
      ? NestedUpdateArg<T>
      : AllowNull<T>;

export type UpdateArgs<T extends Entity> = InputIdentity<T> & {
  [K in keyof T]?: UpdateArg<T[K]>;
};

export type UpdateOptions<T extends Entity> = {
  data: UpdateArgs<T>;
  select?: SelectOptions<T>;
};

export type DeleteOptions<T extends Entity> = InputIdentity<T>;

// ============================================================================
// Bulk Opetations
// ============================================================================

export type BulkCreateOptions<T extends Entity> = {
  data: CreateArgs<T>[];
  select?: SelectOptions<T>;
};

export type BulkSetArg<T> =
  T extends Array<infer P>
    ? P extends Entity
      ? never
      : T
    : T extends Entity
      ? { id: ID | null }
      : T;

export type BulkSetOptions<
  T extends Entity,
  U = Omit<T, keyof Entity>,
> = OmitByType<{ [K in keyof U]?: BulkSetArg<U[K]> }, Array<any> | undefined>;

export type BulkUpdateOptions<T extends Entity> = {
  set: BulkSetOptions<T>;
  where?: WhereOptions<T>;
};

export type BulkDeleteOptions<T extends Entity> = {
  where?: WhereOptions<T>;
};
