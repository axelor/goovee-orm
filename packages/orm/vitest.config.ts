import path from "node:path";

import { transformSync } from "@swc/core";
import { defaultExclude, defineConfig } from "vitest/config";

const unitTests = {
  environment: "node",
  exclude: [...defaultExclude, "src/test"],
};

const e2eTests = {
  environment: "node",
  setupFiles: ["src/test/test-setup.ts"],
  globalSetup: ["src/test/global-setup.ts"],
  include: ["src/test/*.test.ts"],
};

export default defineConfig((env) => {
  return {
    plugins: [
      {
        name: "swc",
        async transform(code, id, options) {
          const res = transformSync(code, {
            filename: id,
            jsc: {
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
    test: env.mode === "e2e" ? e2eTests : unitTests,
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
