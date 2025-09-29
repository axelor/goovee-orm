export type TranspileConfig = {
  /**
   * Defaults to `esnext`
   */
  target?:
    | "es2017"
    | "es2018"
    | "es2019"
    | "es2020"
    | "es2021"
    | "es2022"
    | "es2023"
    | "es2024"
    | "esnext";

  /**
   * Defaults to `esnext`
   */
  module?: "commonjs" | "esnext";
};

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

  /**
   * Transpile configuration.
   */
  transpile?: boolean | TranspileConfig;
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
