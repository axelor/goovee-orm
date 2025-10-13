import { describe, expect, it } from "vitest";
import { CodeFile } from "./CodeFile";
import { Emittable } from "./Emittable";
import { Type } from "./Type";

const emit = (e: Emittable) => {
  const file = new CodeFile("test.ts");
  e.emit(file);
  return file.toJSON().trim();
};

describe("Type tests", () => {
  it("should emit", () => {
    const type = new Type("Page");
    type.field("start", { type: "number", value: 0 });
    type.field("end", { type: "number" });
    const code = emit(type);
    expect(code).toBe(`\
type Page = {
  start?: number = 0;
  end?: number;
}`);
  });

  it("should emit alias type", () => {
    const type = new Type("Num", {
      alias: "number | bigint",
      export: true,
    });
    const code = emit(type);
    expect(code).toBe("export type Num = number | bigint");
  });
});
