import type { BigDecimal } from "../fields/decimal";
import type { Entity, ID, InputIdentity, OmitByType, ToMany } from "./base";
import type { SelectOptions, WhereOptions } from "./query";

// ============================================================================
// Create/Update/Delete Types
// ============================================================================

// The `mappedBy` key carried by a ToMany collection type — the field on the
// target entity that the ORM fills with the owning record on nested creates.
// Plain (unbranded) arrays yield never.
type MappedByKey<T, P extends Entity> =
  T extends ToMany<P, infer K> ? (K extends keyof P ? K : never) : never;

// CreateArgs<T> for targets created nested under the owning side of a
// collection: the mappedBy field is auto-filled by the ORM, so it becomes
// optional. Top-level creates use CreateArgs<T> directly and keep requiring
// it — there is no owner to fill it from.
type NestedCreateArgs<T extends Entity, MappedBy extends keyof T> = Omit<
  CreateArgs<T>,
  MappedBy
> & {
  [K in MappedBy]?: CreateArg<T[K]>;
};

interface NestedCreateArg<T extends Entity> {
  select?: WhereOptions<T>;
  create?: CreateArgs<T>;
}

interface NestedCreateManyArg<
  T extends Entity,
  MappedBy extends keyof T = never,
> {
  select?: WhereOptions<T> | WhereOptions<T>[];
  create?: NestedCreateArgs<T, MappedBy> | NestedCreateArgs<T, MappedBy>[];
}

type AllowNull<T> = T extends undefined ? T | null : T;

type LeafArg<T> = T extends BigDecimal
  ? AllowNull<string | number | bigint | T>
  : AllowNull<T>;

export type CreateArg<T> =
  T extends Array<infer P>
    ? P extends Entity
      ? NestedCreateManyArg<P, MappedByKey<T, P>>
      : T
    : T extends Entity
      ? NestedCreateArg<T>
      : LeafArg<T>;

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

type NestedUpdateManyArg<
  T extends Entity,
  MappedBy extends keyof T = never,
> = {
  select?: WhereOptions<T> | WhereOptions<T>[];
  create?: NestedCreateArgs<T, MappedBy> | NestedCreateArgs<T, MappedBy>[];
  update?: UpdateArgs<T> | UpdateArgs<T>[];
  remove?: ID | ID[];
};

export type UpdateArg<T> =
  T extends Array<infer P>
    ? P extends Entity
      ? NestedUpdateManyArg<P, MappedByKey<T, P>>
      : T
    : T extends Entity
      ? NestedUpdateArg<T>
      : LeafArg<T>;

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
      : LeafArg<T>;

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
