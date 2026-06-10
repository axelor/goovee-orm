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
  readonly id?: ID | null;
  readonly version?: number | null;
  readonly createdOn?: Date | null;
  readonly updatedOn?: Date | null;
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

// TS 6.0 infers the exact argument shape (unknown keys included), so T[K]
// checks a value against itself — excess keys pass. U[K] checks against the
// declared shape instead. The phantom-key branch keeps T[K] referenced so
// TypeScript still infers T and Payload<T,U> still narrows to selected fields.
// https://github.com/microsoft/TypeScript/issues/63515
export type Options<T, U> = {
  [K in keyof T]: K extends keyof U
    ? K extends "__use_T_so_it_is_inferred__"
      ? T[K]
      : U[K]
    : never;
};

export type OrderBy = "ASC" | "DESC";
