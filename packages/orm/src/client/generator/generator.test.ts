import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { generateClient, transpileClient } from "./generator";

const cleanUp = (outDir: string, files: string[]) => {
  files.filter((x) => fs.existsSync(x)).forEach((x) => fs.rmSync(x));
  files
    .map((x) => path.dirname(x))
    .filter((x, i, vals) => vals.indexOf(x) === i)
    .filter((x) => fs.existsSync(x))
    .filter((x) => fs.readdirSync(x).length === 0)
    .forEach((x) => fs.rmdirSync(x));

  if (fs.readdirSync(outDir).length === 0) {
    fs.rmdirSync(outDir);
  }
};

describe("client generator tests", () => {
  it("should generate client", () => {
    const schemaDir = path.join(__dirname, "..", "..", "test", "schema");
    const outDir = fs.mkdtempSync(path.join(__dirname, "db."));
    const files = generateClient([schemaDir], outDir);
    expect(files.length).toBeGreaterThan(0);
    cleanUp(outDir, files);
  });

  it("should transpile client", () => {
    const schemaDir = path.join(__dirname, "..", "..", "test", "schema");
    const outDir = fs.mkdtempSync(path.join(__dirname, "transpile."));
    const files = generateClient([schemaDir], outDir);
    const outputFiles = transpileClient(files, {
      target: "esnext",
    });

    expect(outputFiles.length).toBeGreaterThan(0);

    // Check that .js files were generated
    const jsFiles = outputFiles.filter((file) => file.endsWith(".js"));
    jsFiles.forEach((file) => {
      expect(fs.existsSync(file)).toBe(true);
    });

    // Check that .d.ts files were generated
    const dtsFiles = outputFiles.filter((file) => file.endsWith(".d.ts"));
    dtsFiles.forEach((file) => {
      expect(fs.existsSync(file)).toBe(true);
    });

    // Each .js should have a corresponding .d.ts
    expect(jsFiles.length).toEqual(dtsFiles.length);
    jsFiles.forEach((jsFile) => {
      const dtsFile = jsFile.replace(/\.js$/, ".d.ts");
      expect(dtsFiles).toContain(dtsFile);
    });

    cleanUp(outDir, files);
    cleanUp(outDir, outputFiles);
  });
});
