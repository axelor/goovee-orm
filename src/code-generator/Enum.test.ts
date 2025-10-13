import { describe, expect, it } from "vitest";
import { CodeFile } from "./CodeFile";
import { Emittable } from "./Emittable";
import { Enum } from "./Enum";

const emit = (e: Emittable) => {
  const file = new CodeFile("test.ts");
  e.emit(file);
  return file.toJSON().trim();
};

describe("Enum tests", () => {
  it("should emit", () => {
    const type = new Enum("Status");
    type.enum("DRAFT");
    type.enum("STARTED");
    type.enum("CLOSED");
    type.enum("CANCELED");
    const code = emit(type);
    expect(code).toBe(`\
enum Status {
  DRAFT,
  STARTED,
  CLOSED,
  CANCELED
}`);
  });

  it("should emit number enums", () => {
    const type = new Enum("Status");
    type.enum("DRAFT", 1);
    type.enum("STARTED", 2);
    type.enum("CLOSED", 3);
    type.enum("CANCELED", 4);
    const code = emit(type);
    expect(code).toBe(`\
enum Status {
  DRAFT = 1,
  STARTED = 2,
  CLOSED = 3,
  CANCELED = 4
}`);
  });

  it("should emit string enums", () => {
    const type = new Enum("Status");
    type.enum("DRAFT", "draft");
    type.enum("STARTED", "started");
    type.enum("CLOSED", "closed");
    type.enum("CANCELED", "canceled");
    const code = emit(type);
    expect(code).toBe(`\
enum Status {
  DRAFT = "draft",
  STARTED = "started",
  CLOSED = "closed",
  CANCELED = "canceled"
}`);
  });
});
