import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { generateClient } from "./generator";

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
});
