import swc from "unplugin-swc";
import { defineConfig,defaultExclude } from "vitest/config";

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    environment: "node",
    exclude: [...defaultExclude, "src/test"]
  },
});
