import type { QueryClient } from "./client";

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
