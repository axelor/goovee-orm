import path from "node:path";

import { transformSync } from "@swc/core";
import { defaultExclude, defineConfig } from "vitest/config";

const unitTests = {
  include: ["src/**/*.test.ts"],
  exclude: [...defaultExclude, "src/test"],
};

const e2eTests = {
  include: ["src/test/**/*.test.ts"],
  setupFiles: ["src/test/test-setup.ts"],
  globalSetup: ["src/test/global-setup.ts"],
};

export default defineConfig((env) => {
  const testConfig = env.mode === "e2e" ? e2eTests : unitTests;
  return {
    plugins: [
      {
        name: "swc",
        async transform(code, id, options) {
          const res = transformSync(code, {
            filename: id,
            sourceMaps: true,
            jsc: {
              target: "es2022",
              parser: {
                syntax: "typescript",
                decorators: true,
              },
              transform: {
                legacyDecorator: true,
                decoratorMetadata: true,
              },
            },
          });
          return res;
        },
        config() {
          return {
            esbuild: false,
          };
        },
      },
    ],
    test: {
      environment: "node",
      globals: true,
      ...testConfig,
    },
    resolve: {
      alias: [
        {
          find: "@goovee/orm",
          replacement: path.join(__dirname, "src"),
        },
      ],
    },
  };
});
