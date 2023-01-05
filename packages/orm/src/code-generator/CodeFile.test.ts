import { describe, expect, it } from "vitest";
import { CodeFile } from "./CodeFile";
import { Emittable } from "./Emittable";

const emit = (e: Emittable) => {
  const file = new CodeFile("test.ts");
  e.emit(file);
  return file.toJSON().trim();
};

describe("CodeFile tests", () => {
  it("should import types", () => {
    const file = new CodeFile("test.ts");
    const some = file.importName("some", "./some");
    expect(some).toBe("some");

    const thing = file.importName("type thing", "./some.types");
    expect(thing).toBe("thing");

    const TSome = file.importName("type some as TSome", "./some.types");
    expect(TSome).toBe("TSome");

    const Some = file.importName("some as Some", "./some");
    expect(Some).toBe("Some");

    const code = file.toJSON();
    expect(code).toBe(`\
import { some, some as Some } from "./some";
import { type thing, type some as TSome } from "./some.types";
`);
  });
});
