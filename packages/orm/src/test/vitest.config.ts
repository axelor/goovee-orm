import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    environment: "node",
    setupFiles: ["src/test/test-setup.ts"],
    globalSetup: ["src/test/global-setup.ts"],
    include: ["src/test/*.test.ts"],
  },
});
