export type EQ<T> = { eq: T | null } | T | null;
export type NE<T> = { ne: T | null };
export type GT<T> = { gt: T };
export type GE<T> = { ge: T };
export type LT<T> = { lt: T };
export type LE<T> = { le: T };
export type IN<T> = { in: T[] };
export type BETWEEN<T> = { between: [T, T] };
export type LIKE<T> = { like: T };
export type NOT_IN<T> = { notIn: T[] };
export type NOT_BETWEEN<T> = { notBetween: [T, T] };
export type NOT_LIKE<T> = { notLike: T };

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
  | NOT_IN<T>
  | NOT_BETWEEN<T>
  | NOT_LIKE<T>;

export type StringFilter =
  | EQ<string>
  | NE<string>
  | IN<string>
  | LIKE<string>
  | NOT_IN<string>
  | NOT_LIKE<string>;

export type BooleanFilter = EQ<boolean> | NE<boolean>;

export type IntFilter = NumericFilter<number>;
export type BigIntFilter = NumericFilter<bigint>;
export type DecimalFilter = NumericFilter<string>;
export type DateFilter = NumericFilter<Date | string>;
export type IdFilter = NumericFilter<ID>;

export type ID = string | number;

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
  : Arg extends true // simple or relation
  ? T
  : T extends Array<infer A> // ToMany
  ? Arg extends { select: infer Select }
    ? A extends Entity
      ? PayloadSelect<A, Select>[]
      : never
    : never
  : T extends Entity // ToOne
  ? Arg extends object
    ? PayloadSelect<T, Arg>
    : never
  : T; // everything else

export type PayloadSimple<T extends Entity> = ResultIdentity<T> &
  OmitType<T, Entity | Entity[] | undefined>;

export type Payload<T extends Entity, Q> = Q extends { select: infer S }
  ? PayloadSelect<T, S>
  : PayloadSimple<T>;

export type NestedCreateArg<T extends Entity> = {
  select?: WhereOptions<T>;
  create?: CreateArgs<T>;
};

export type NestedCreateManyArg<T extends Entity> = {
  select?: WhereOptions<T> | WhereOptions<T>[];
  create?: CreateArgs<T> | CreateArgs<T>[];
};

export type CreateArg<T> = T extends Array<infer P>
  ? P extends Entity
    ? NestedCreateManyArg<P>
    : T
  : T extends Entity
  ? NestedCreateArg<T>
  : T;

export type CreateArgs<T extends Entity> = {
  [K in keyof T]: CreateArg<T[K]>;
};

export type CreateOptions<T extends Entity> = {
  data: CreateArgs<T>;
  select?: SelectOptions<T>;
};

export type NotNull<T> = T extends undefined ? never : T;

export type InputIdentity<T extends Entity> = {
  id: ID;
  version: number;
};

export type ResultIdentity<T extends Entity> = {
  id: NotNull<T["id"]>;
  version: number;
};

export type NestedUpdateArg<T extends Entity> = {
  select?: WhereOptions<T>;
  create?: CreateArgs<T>;
  update?: UpdateArgs<T>;
};

export type NestedUpdateManyArg<T extends Entity> = {
  select?: WhereOptions<T> | WhereOptions<T>[];
  create?: CreateArgs<T> | CreateArgs<T>[];
  update?: UpdateArgs<T> | UpdateArgs<T>[];
};

export type UpdateArg<T> = T extends Array<infer P>
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

export type DeleteOptions<T extends Entity> = InputIdentity<T>;

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
  find<Options extends QueryOptions<T>>(
    args: Options
  ): Promise<Payload<T, Options>[]>;
  findOne<Options extends QueryOptions<T>>(
    args: Options
  ): Promise<Payload<T, Options>>;
  create<Options extends CreateOptions<T>>(
    args: Options
  ): Promise<Payload<T, Options>>;
  update<Options extends UpdateOptions<T>>(
    args: Options
  ): Promise<Payload<T, Options>>;
  delete(args: DeleteOptions<T>): Promise<ID>;
  count(): Promise<ID>;
  count<Options extends QueryOptions<T>>(args: Options): Promise<ID>;
  updateAll(args: BulkUpdateOptions<T>): Promise<ID>;
  deleteAll(): Promise<ID>;
  deleteAll(args: BulkDeleteOptions<T>): Promise<ID>;
}
