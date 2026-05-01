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

  it("should emit extensionless imports without transpile", () => {
    const schemaDir = path.join(__dirname, "..", "..", "test", "schema");
    const outDir = fs.mkdtempSync(path.join(__dirname, "noext."));
    const files = generateClient([schemaDir], outDir);

    const tsFiles = files.filter((f) => f.endsWith(".ts"));
    expect(tsFiles.length).toBeGreaterThan(0);
    for (const file of tsFiles) {
      const code = fs.readFileSync(file, { encoding: "utf-8" });
      // reject any relative import with an extension, e.g. `from "./Foo.js"`
      expect(code).not.toMatch(/from "\.\/[A-Z][A-Za-z]*\.[a-z]+"/);
    }

    cleanUp(outDir, files);
  });

  it("should emit .js imports when transpile is requested", () => {
    const schemaDir = path.join(__dirname, "..", "..", "test", "schema");
    const outDir = fs.mkdtempSync(path.join(__dirname, "ext."));
    const files = generateClient([schemaDir], outDir, { transpile: true });

    const code = fs.readFileSync(path.join(outDir, "models", "Contact.ts"), {
      encoding: "utf-8",
    });
    // require at least one relative import with a `.js` extension
    expect(code).toMatch(/from "\.\/[A-Z][A-Za-z]*\.js"/);

    const clientCode = fs.readFileSync(
      path.join(outDir, "client", "index.ts"),
      { encoding: "utf-8" },
    );
    expect(clientCode).toContain('from "../models/index.js"');

    cleanUp(outDir, files);
  });

  it("should produce transpiled output with resolvable .js imports", () => {
    const schemaDir = path.join(__dirname, "..", "..", "test", "schema");
    const outDir = fs.mkdtempSync(path.join(__dirname, "e2e."));
    const files = generateClient([schemaDir], outDir, { transpile: true });
    const outputFiles = transpileClient(files, { target: "esnext" });

    const code = fs.readFileSync(path.join(outDir, "models", "Contact.js"), {
      encoding: "utf-8",
    });
    // require at least one relative `.js` import; tsc may emit either quote style
    expect(code).toMatch(/from ['"]\.\/[A-Z][A-Za-z]*\.js['"]/);

    cleanUp(outDir, files);
    cleanUp(outDir, outputFiles);
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
