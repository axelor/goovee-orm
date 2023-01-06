import { describe, expect, it } from "vitest";
import { CodeFile } from "./CodeFile";
import { ContainerType } from "./Container";
import { Variable } from "./Variable";

const emit = (v: Variable) => {
  const file = new CodeFile("test.ts");
  v.emit(file);
  return file.toJSON().trim();
};

describe("Variable tests", () => {
  it("should emit", () => {
    const variable = new Variable("hello", {
      type: "string",
      value: "Hello!!!",
      modifier: "const",
    });
    const code = emit(variable);
    expect(code).equals('const hello: string = "Hello!!!"');
  });

  it("should emit quoted string", () => {
    const variable = new Variable("hello", {
      value: "Hello!!!",
      modifier: "const",
      quote: true,
    });
    const code = emit(variable);
    expect(code).equals('const hello = "Hello!!!"');
  });

  it("should emit number", () => {
    const variable = new Variable("hello", {
      value: "1000",
      modifier: "const",
    });
    const code = emit(variable);
    expect(code).equals("const hello = 1000");
  });

  it("should emit exclamation mark", () => {
    const variable = new Variable("hello", {
      type: "string",
      required: true,
      field: true,
      ownerType: ContainerType.CLASS,
    });
    const code = emit(variable);
    expect(code).equals("hello!: string;");
  });

  it("should emit question mark", () => {
    const variable = new Variable("hello", {
      type: "string",
      required: false,
      field: true,
    });
    const code = emit(variable);
    expect(code).equals("hello?: string;");
  });

  it("should emit jsdoc", () => {
    const field = new Variable("name", {
      type: "string",
    });
    field.doc("Name of the entity.");
    const code = emit(field);
    expect(code).toBe(`\
/**
 * Name of the entity.
 */
name?: string`);
  });
});
