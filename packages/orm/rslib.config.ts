import { defineConfig, rspack } from "@rslib/core";

const ignore = new rspack.IgnorePlugin({
  resourceRegExp: /.*/,
  contextRegExp: /test\//,
});

export default defineConfig({
  source: {
    entry: {
      index: [
        "src/**",
        "!src/**/*.test.*",
        "!src/test/**",
        "!src/cli/index-dev.mjs",
      ],
    },
    tsconfigPath: "tsconfig.build.json",
  },
  output: {
    target: "node",
    sourceMap: true,
    externals: ["typeorm", "commander", "pg", "graphql"],
  },
  lib: [
    {
      format: "esm",
      bundle: false,
      dts: true,
    },
    {
      format: "cjs",
      bundle: false,
    },
  ],
});
