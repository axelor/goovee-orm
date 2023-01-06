import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { generateProject } from "./client-generator";

const expectedFiles = ["package.json", "tsconfig.json"];
const outDir = path.join("node_modules", "client-gen");

const cleanUp = () => {
  expectedFiles
    .map((x) => path.join(outDir, x))
    .filter((x) => fs.existsSync(x))
    .forEach((x) => {
      fs.rmSync(x);
    });
  if (fs.existsSync(outDir)) {
    fs.rmdirSync(outDir);
  }
};

describe("client generator tests", () => {
  afterEach(cleanUp);
  it("should generate client files", () => {
    const files = generateProject(outDir);
    expect(files).toHaveLength(expectedFiles.length);
    expect(files).toEqual(expect.arrayContaining(expectedFiles));
  });
});
