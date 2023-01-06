import { describe, expect, it } from "vitest";
import { CodeFile } from "./CodeFile";
import { Emittable } from "./Emittable";
import { Interface } from "./Interface";

const emit = (e: Emittable) => {
  const file = new CodeFile("test.ts");
  e.emit(file);
  return file.toJSON().trim();
};

describe("Interface tests", () => {
  it("should emit", () => {
    const type = new Interface("Type", {
      extends: ["Some", "Another"],
    });
    type.field("name", {
      type: "string",
      required: true,
    });
    type.field("age", {
      type: "number",
      modifier: "readonly",
      value: 200,
    });
    type.method("test", {
      type: "number",
    });
    const code = emit(type);
    expect(code).toBe(`\
interface Type extends Some, Another {
  name: string;
  readonly age?: number = 200;
  test(): number;
}`);
  });
});
