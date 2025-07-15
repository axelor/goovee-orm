import type { BigDecimal } from "./decimal";

// ============================================================================
// Base Types
// ============================================================================

export type ID = string | number;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | JsonObject;

export type JsonObject = {
  [key: string]: JsonValue;
};

// Async data types
export type Json = Promise<JsonObject>;
export type Text = Promise<string>;
export type Binary = Promise<Buffer>;

// ============================================================================
// Entity Types
// ============================================================================

export type Entity = {
  readonly id?: ID;
  readonly version?: number;
  readonly createdOn?: Date;
  readonly updatedOn?: Date;
};

export type EntityClass<T extends Entity = Entity> = new () => T;

// Identity types
export type InputIdentity<T extends Entity> = {
  id: ID;
  version: number;
};

export type ResultIdentity<T extends Entity> = {
  id: NonNullable<T["id"]>;
  version: number;
};

// ============================================================================
// Utility Types
// ============================================================================

export type NotNull<T> = T extends undefined ? never : T;

export type OmitByType<T, Type> = Pick<
  T,
  { [K in keyof T]-?: T[K] extends Type ? never : K }[keyof T]
>;

export type Options<T, U> = {
  [K in keyof T]: K extends keyof U ? T[K] : never;
};

export type OrderBy = "ASC" | "DESC";

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

// ============================================================================
// Query Building Types
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
  [K in keyof SelectKeys<T, Select>]: K extends keyof Select & keyof T
    ? PayloadSelectArg<T[K], Select[K]>
    : never;
};

type PayloadSelectArg<T, Arg> = Arg extends undefined | null | false
  ? never
  : Arg extends true
    ? T
    : T extends Array<infer A>
      ? Arg extends { select: infer Select }
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

// ============================================================================
// Create/Update Types
// ============================================================================

interface NestedCreateArg<T extends Entity> {
  select?: WhereOptions<T>;
  create?: CreateArgs<T>;
}

interface NestedCreateManyArg<T extends Entity> {
  select?: WhereOptions<T> | WhereOptions<T>[];
  create?: CreateArgs<T> | CreateArgs<T>[];
}

export type CreateArg<T> =
  T extends Array<infer P>
    ? P extends Entity
      ? NestedCreateManyArg<P>
      : T
    : T extends Entity
      ? NestedCreateArg<T>
      : T extends BigDecimal
        ? string | number | bigint | T
        : T extends undefined
          ? T | null
          : T;

export type CreateArgs<T extends Entity> = {
  [K in keyof T]: CreateArg<T[K]>;
};

export type CreateOptions<T extends Entity> = {
  data: CreateArgs<T>;
  select?: SelectOptions<T>;
};

// Update types
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
      : T;

export type UpdateArgs<T extends Entity> = InputIdentity<T> & {
  [K in keyof T]?: UpdateArg<T[K]>;
};

export type UpdateOptions<T extends Entity> = {
  data: UpdateArgs<T>;
  select?: SelectOptions<T>;
};

// Delete types
export type DeleteOptions<T extends Entity> = InputIdentity<T>;

export type BulkDeleteOptions<T extends Entity> = {
  where?: WhereOptions<T>;
};

// Bulk operations
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

// ============================================================================
// Aggregate Types
// 
// Note: Aggregate queries use offset-based pagination (take/skip) rather than
// cursor-based pagination due to the complexity of implementing stable cursors
// for computed aggregate results, especially with GROUP BY operations.
// ============================================================================

export type Numeric = number | bigint | BigDecimal;
export type Countable = string | number | boolean | Date | bigint | BigDecimal;

export type AggregateOperation =
  | "_avg"
  | "_sum"
  | "_min"
  | "_max"
  | "_count"
  | "groupBy";
export type NumericOperation = "_avg" | "_sum";
export type CountableOperation = "_min" | "_max" | "_count" | "groupBy";

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
      : Op extends "_avg" | "_sum"
        ? NonNullable<T[K]> extends Numeric
          ? K
          : never
        : Op extends "_count" | "_min" | "_max" | "groupBy"
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

export type NumericSelect<T extends Entity> = AggregateSelect<T, "_avg">;
export type CountableSelect<T extends Entity> = AggregateSelect<T, "_min">;

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
  _avg?: AggregateSelect<T, "_avg">;
  _sum?: AggregateSelect<T, "_sum">;
  _min?: AggregateSelect<T, "_min">;
  _max?: AggregateSelect<T, "_max">;
  _count?: AggregateSelect<T, "_count">;
  groupBy?: AggregateSelect<T, "groupBy">;
  orderBy?: AggregateOrderBy<T>;
  having?: AggregateHaving<T>;
  where?: WhereOptions<T>;
  /** Limit the number of results returned (offset-based pagination) */
  take?: number;
  /** Skip the specified number of results (offset-based pagination) */
  skip?: number;
};

export type OrderByFromSelection<S> = {
  [K in keyof S]?: S[K] extends true
    ? OrderBy
    : S[K] extends object
      ? OrderByFromSelection<S[K]>
      : never;
};

type AggregateResultType<T, Op extends AggregateOperation> = Op extends "_count"
  ? number
  : Op extends "_avg" | "_sum"
    ? number
    : Op extends "_min" | "_max"
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

// ============================================================================
// Client Types
// ============================================================================

export type QueryClient = {
  $raw(query: string, ...params: any[]): Promise<unknown>;
};

export type ConnectionClient<T extends QueryClient> = T & {
  readonly $connected: boolean;
  $use(middleware: Middleware): ConnectionClient<T>;
  $sync(): Promise<void>;
  $sync(drop: boolean): Promise<void>;
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $transaction<R>(job: (client: T) => Promise<R>): Promise<R>;
};

export type EntityClient<T extends Record<string, EntityClass>> =
  QueryClient & {
    [K in keyof T]: T[K] extends EntityClass<infer E> ? Repository<E> : never;
  };

export type ClientFeatures = {
  /**
   * Text normalization applied to both filtering and sorting
   */
  normalization?: {
    /**
     * Convert text to lower case before comparison
     */
    lowerCase?: boolean;
    /**
     * Remove accents/diacritics (e.g., é -> e)
     */
    unaccent?: boolean;
  };
};

export type ClientOptions = {
  url?: string;
  sync?: boolean;
  features?: ClientFeatures;
};

// ============================================================================
// Repository Interface
// ============================================================================

export interface Repository<T extends Entity> {
  readonly name: string;

  find<U extends QueryOptions<T>>(): Promise<Payload<T, U>[]>;
  find<U extends QueryOptions<T>>(
    args: Options<U, QueryOptions<T>>,
  ): Promise<Payload<T, U>[]>;

  findOne<U extends QueryOptions<T>>(): Promise<Payload<T, U> | null>;
  findOne<U extends QueryOptions<T>>(
    args: Options<U, QueryOptions<T>>,
  ): Promise<Payload<T, U> | null>;

  create<U extends CreateOptions<T>>(
    args: Options<U, CreateOptions<T>>,
  ): Promise<Payload<T, U>>;

  update<U extends UpdateOptions<T>>(
    args: Options<U, UpdateOptions<T>>,
  ): Promise<Payload<T, U>>;

  delete(args: DeleteOptions<T>): Promise<ID>;

  count(): Promise<ID>;
  count(args: QueryOptions<T>): Promise<ID>;

  aggregate<U extends AggregateOptions<T>>(
    args: Options<U, AggregateOptions<T>>,
  ): Promise<AggregatePayload<T, U>[]>;

  updateAll(args: BulkUpdateOptions<T>): Promise<ID>;

  deleteAll(): Promise<ID>;
  deleteAll(args: BulkDeleteOptions<T>): Promise<ID>;
}

// ============================================================================
// Middleware Types
// ============================================================================

export type MiddlewareArgs = {
  /**
   * The QueryClient in use.
   *
   * The middleware should use this client only if required.
   */
  client: QueryClient;

  /**
   * The source object on which method the middleware is applied
   */
  source: any;

  /**
   * The method on which the middleware is applied
   */
  method: string;

  /**
   * The method arguments.
   *
   * The middleware can modify these arguments.
   */
  args: any[];
};

export type Middleware = (
  params: MiddlewareArgs,
  next: () => Promise<any>,
) => Promise<any>;
