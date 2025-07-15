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
