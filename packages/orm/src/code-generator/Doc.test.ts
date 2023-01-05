import { describe, expect, it } from "vitest";
import { CodeFile } from "./CodeFile";
import { Doc } from "./Doc";
import { Emittable } from "./Emittable";

const emit = (e: Emittable) => {
  const file = new CodeFile("test.ts");
  e.emit(file);
  return file.toJSON().trim();
};

describe("Doc tests", () => {
  it("should emit", () => {
    const doc = new Doc();
    doc.line("Say what you want.");
    doc.line("");
    doc.line("This method will print the given message.");
    doc.line("");
    doc.line("@param {string} what - the message");
    const code = emit(doc);
    expect(code).toBe(`\
/**
 * Say what you want.
 *
 * This method will print the given message.
 *
 * @param {string} what - the message
 */`);
  });
});
