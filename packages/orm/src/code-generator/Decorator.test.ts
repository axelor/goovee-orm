import { describe, expect, it } from "vitest";
import { CodeFile } from "./CodeFile";
import { Decorator } from "./Decorator";
import { Emittable } from "./Emittable";

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
    });
    const code = emit(decorator);
    expect(code).to.equals(
      '@decorator("name", 1, true, { required: true, title: "Name" })'
    );
  });
  it("should emit callback arg", () => {
    const decorator = new Decorator("decorator");
    decorator.arg("(x) => x.names");
    const code = emit(decorator);
    expect(code).to.equals("@decorator((x) => x.names)");
  });
});
