import path from "node:path";
import swc from "unplugin-swc";
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
    plugins: [swc.vite()],
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
