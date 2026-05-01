import { describe, expect, it } from "vitest";

import { buildPackageJson } from "./generate";

describe("buildPackageJson", () => {
  it("uses module type and default name when transpile is true", () => {
    expect(buildPackageJson(true)).toEqual({
      name: "@goovee/generated",
      version: "1.0.0",
      type: "module",
      exports: {
        "./models": "./models/index.js",
        "./client": "./client/index.js",
      },
    });
  });

  it("uses commonjs type when transpile.module is commonjs", () => {
    expect(buildPackageJson({ module: "commonjs" }).type).toBe("commonjs");
  });

  it("uses module type for non-commonjs transpile config", () => {
    expect(buildPackageJson({ module: "esnext" }).type).toBe("module");
  });

  it("uses transpile.packageName as the package name", () => {
    expect(buildPackageJson({ packageName: "@myorg/db" }).name).toBe(
      "@myorg/db",
    );
  });
});
