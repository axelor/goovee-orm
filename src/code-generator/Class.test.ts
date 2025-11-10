import { describe, expect, it } from "vitest";
import { Class } from "./Class";
import { CodeFile } from "./CodeFile";
import { Emittable } from "./Emittable";

const emit = (e: Emittable) => {
  const file = new CodeFile("test.ts");
  e.emit(file);
  return file.toJSON().trim();
};

describe("Class tests", () => {
  it("should emit", () => {
    const cls = new Class("Test", {
      extends: "Entity",
      export: true,
    });
    cls.field("name", {
      type: "string",
      required: true,
    });
    cls.field("type", {
      type: "string",
      value: "some",
      modifier: "readonly",
    });
    const m = cls.method("title", {
      getter: true,
    });

    m.line("return this.name;");

    const d = cls.decorator("Entity");
    d.arg("test");
    d.arg({
      some: "thing",
    });

    cls.doc(`
  The entity class

  This is just for a Test!

  @see {@link Entity}
    `);

    const code = emit(cls);
    expect(code).toBe(`\
/**
 * The entity class
 *
 * This is just for a Test!
 *
 * @see {@link Entity}
 */
@Entity("test", { some: "thing" })
export class Test extends Entity {
  name!: string;

  readonly type?: string | null = "some";

  get title() {
    return this.name;
  }
}`);
  });
});
