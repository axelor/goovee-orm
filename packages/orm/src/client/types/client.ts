import type { EntityClass } from "./base";
import type { Middleware } from "./middleware";
import type { Repository } from "./repository";

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
