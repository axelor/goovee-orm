import { describe, expect, it } from "vitest";
import { CodeFile } from "./CodeFile";
import { Emittable } from "./Emittable";
import { Method } from "./Method";

const emit = (e: Emittable) => {
  const file = new CodeFile("test.ts");
  e.emit(file);
  return file.toJSON().trim();
};

describe("Method tests", () => {
  it("should emit", () => {
    const method = new Method("say", {
      modifier: "function",
    });
    method.param("what", { type: "string", value: "Hello!" });
    method.param("next", { type: "string" });
    method.param("...args", { type: "string[]" });
    method.line("console.log(`Say: ${what}`);");
    method.line("console.log(`And: ${next}`);");
    method.line("console.log(`Also: ${args.join(' ')}`);");
    const code = emit(method);
    expect(code).equals(`\
function say(what: string = "Hello!", next?: string, ...args: string[]) {
  console.log(\`Say: \${what}\`);
  console.log(\`And: \${next}\`);
  console.log(\`Also: \${args.join(' ')}\`);
}`);
  });

  it("should emit empty arrow function", () => {
    const method = new Method("hello", {
      modifier: "const",
    });
    const code = emit(method);
    expect(code).equals("const hello = () => {}");
  });

  it("should emit empty arrow function without block", () => {
    const method = new Method("hello", {
      modifier: "const",
      arrow: "'Hello!'",
    });
    const code = emit(method);
    expect(code).equals("const hello = () => 'Hello!'");
  });

  it("should emit jsdoc", () => {
    const method = new Method("say", {
      modifier: "function",
    });
    method.param("what", { type: "string" });
    method.doc("Say what you want.");
    method.doc("");
    method.doc("This method will print the given message!");
    method.doc("");
    method.doc("@param {string} what - the message");
    const code = emit(method);
    expect(code).toBe(`\
/**
 * Say what you want.
 *
 * This method will print the given message!
 *
 * @param {string} what - the message
 */
function say(what?: string) {}`);
  });
});
