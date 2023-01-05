import { describe, expect, it } from "vitest";
import { CodeFile } from "./CodeFile";
import { Emittable } from "./Emittable";
import { ImportName } from "./ImportName";
import { Variable } from "./Variable";

const emit = (e: Emittable) => {
  const file = new CodeFile("test.ts");
  e.emit(file);
  return file.toJSON().trim();
};

describe("ImportName tests", () => {
  it("should emit import", () => {
    const name = new ImportName("type EntityOptions as Options", "typeorm");
    const dec = new Variable("opts", {
      type: name,
      modifier: "const",
      value: "{}",
    });
    const code = emit(dec);
    expect(name.name).toBe("Options");
    expect(code).toBe(`\
import { type EntityOptions as Options } from "typeorm";

const opts: Options = {}`);
  });
});
