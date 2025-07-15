/**
 * Schema configuration.
 */
export type SchemaConfig = {
  /**
   * Specifies a list schema directories (glob patterns allowed).
   */
  dirs?: string[];

  /**
   * Output directory.
   */
  outDir?: string;

  /**
   * Clean output directory?
   */
  clean?: boolean;
};

/**
 * Goovee configuration.
 */
export type GooveeConfig = {
  /**
   * Schema configuration.
   */
  schema?: SchemaConfig;
};
