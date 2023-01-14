import { describe, expect, it } from "vitest";
import { CodeFile } from "./CodeFile";
import { Decorator } from "./Decorator";
import { Emittable } from "./Emittable";
import { ImportName } from "./ImportName";

const emit = (e: Emittable) => {
  const file = new CodeFile("test.ts");
  e.emit(file);
  return file.toJSON().trim();
};

describe("decorator tests", () => {
  it("should emit", () => {
    const decorator = new Decorator("decorator");
    decorator.arg("name");
    decorator.arg(1);
    decorator.arg(true);
    decorator.arg({
      required: true,
      title: "Name",
      values: [1, 2, 3],
    });
    decorator.arg(["some", 1, new ImportName("Some", "./some")]);
    const code = emit(decorator);
    expect(code).to.equals(`\
import { Some } from "./some";

@decorator("name", 1, true, { required: true, title: "Name", values: [1, 2, 3] }, ["some", 1, Some])`);
  });
  it("should emit callback arg", () => {
    const decorator = new Decorator("decorator");
    decorator.arg("(x) => x.names");
    const code = emit(decorator);
    expect(code).to.equals("@decorator((x) => x.names)");
  });
});
