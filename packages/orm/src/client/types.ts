export type EQ<T> = { eq: T | null };
export type NE<T> = { ne: T | null };
export type GT<T> = { gt: T };
export type GE<T> = { ge: T };
export type LT<T> = { lt: T };
export type LE<T> = { le: T };
export type IN<T> = { in: T[] };
export type BETWEEN<T> = { between: [T, T] };
export type LIKE<T> = { like: T };
export type NOT<T> = { not: IN<T> | BETWEEN<T> | LIKE<T> };

export type NumericFilter<T> =
  | EQ<T>
  | NE<T>
  | GT<T>
  | GE<T>
  | LT<T>
  | LE<T>
  | IN<T>
  | BETWEEN<T>
  | LIKE<T>
  | NOT<T>;

export type StringFilter =
  | EQ<string>
  | NE<string>
  | IN<string>
  | LIKE<string>
  | NOT<string>;

export type BooleanFilter = EQ<boolean> | NE<boolean>;

export type IntFilter = NumericFilter<number>;
export type BigIntFilter = NumericFilter<bigint>;
export type DecimalFilter = NumericFilter<string>;
export type DateFilter = NumericFilter<Date | string>;
export type IdFilter = NumericFilter<ID>;

export type ID = string | number | bigint;

export interface Entity {
  readonly id?: ID;
  readonly version?: number;
  readonly createdOn?: Date;
  readonly updatedOn?: Date;
}

export type SelectArg<T> = T extends Array<infer P>
  ? P extends Entity
    ? QueryOptions<P>
    : boolean
  : T extends Entity
  ? SelectOptions<T>
  : boolean;

export type SelectOptions<T extends Entity> = {
  -readonly [K in keyof T]?: SelectArg<T[K]>;
};

export type WhereArg<T> = T extends number
  ? IntFilter
  : T extends bigint
  ? BigIntFilter
  : T extends boolean
  ? BooleanFilter
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
  : never;

export type WhereOptions<T extends Entity> =
  | {
      -readonly [K in keyof T]?: K extends "id" ? IdFilter : WhereArg<T[K]>;
    }
  | {
      OR?: WhereOptions<T>[];
      AND?: WhereOptions<T>[];
      NOT?: WhereOptions<T>[];
    };

export type Cursor<T extends Entity> = {
  id: ID;
};

export type QueryOptions<T extends Entity> = {
  select?: SelectOptions<T>;
  where?: WhereOptions<T>;
  cursor?: Cursor<T>;
  take?: number;
  skip?: number;
};

export type PayloadArg<T> = T extends Array<infer P>
  ? P extends Entity
    ? QueryPayload<P>
    : T
  : T extends Entity
  ? Payload<T>
  : T;

export type Payload<T extends Entity> = {
  [K in keyof T]?: PayloadArg<T[K]>;
};

export type QueryPayload<T extends Entity> = {
  data: Payload<T>[];
  startCursor?: Cursor<T>;
};

export type NestedCreateArg<T extends Entity> = {
  select?: WhereOptions<T>;
  create?: CreateOptions<T>;
};

export type NestedCreateManyArg<T extends Entity> = {
  select?: WhereOptions<T> | WhereOptions<T>[];
  create?: CreateOptions<T> | CreateOptions<T>[];
};

export type CreateArg<T> = T extends Array<infer P>
  ? P extends Entity
    ? NestedCreateManyArg<P>
    : T
  : T extends Entity
  ? NestedCreateArg<T>
  : T;

export type CreateOptions<T extends Entity, U = Omit<T, keyof Entity>> = {
  [K in keyof U]: CreateArg<U[K]>;
};

export type NotNull<T> = T extends undefined ? never : T;

export type Identity<T extends Entity> = {
  id: ID;
  version: number;
};

export type NestedUpdateArg<T extends Entity> = {
  select?: WhereOptions<T>;
  create?: CreateOptions<T>;
  update?: UpdateOptions<T>;
};

export type NestedUpdateManyArg<T extends Entity> = {
  select?: WhereOptions<T> | WhereOptions<T>[];
  create?: CreateOptions<T> | CreateOptions<T>[];
  update?: UpdateOptions<T> | UpdateOptions<T>[];
};

export type UpdateArg<T> = T extends Array<infer P>
  ? P extends Entity
    ? NestedUpdateManyArg<P>
    : T
  : T extends Entity
  ? NestedUpdateArg<T>
  : T;

export type UpdateOptions<
  T extends Entity,
  U = Omit<T, keyof Entity>
> = Identity<T> & {
  [K in keyof U]?: UpdateArg<U[K]>;
};

export type DeleteOptions<T extends Entity> = Identity<T>;

export type BulkSetArg<T> = T extends Array<infer P>
  ? P extends Entity
    ? never
    : T
  : T extends Entity
  ? { id: ID | null }
  : T;

export type OmitType<T, Type> = Pick<
  T,
  { [K in keyof T]-?: T[K] extends Type ? never : K }[keyof T]
>;

export type BulkSetOptions<
  T extends Entity,
  U = Omit<T, keyof Entity>
> = OmitType<
  {
    [K in keyof U]?: BulkSetArg<U[K]>;
  },
  Array<any> | undefined
>;

export type BulkUpdateOptions<T extends Entity> = {
  set: BulkSetOptions<T>;
  where?: WhereOptions<T>;
};

export type BulkDeleteOptions<T extends Entity> = {
  where?: WhereOptions<T>;
};

export interface Repository<T extends Entity> {
  find(args: QueryOptions<T>): Promise<QueryPayload<T>>;
  findOne(args: WhereOptions<T>): Promise<Payload<T>>;
  create(args: CreateOptions<T>): Promise<T>;
  update(args: UpdateOptions<T>): Promise<T>;
  delete(args: DeleteOptions<T>): Promise<ID>;
  updateAll(args: BulkUpdateOptions<T>): Promise<ID>;
  deleteAll(args: BulkDeleteOptions<T>): Promise<ID>;
}
