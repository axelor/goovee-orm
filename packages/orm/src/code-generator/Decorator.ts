import { CodeFile } from "./CodeFile";
import { ImportName } from "./ImportName";

class UnQuotedString {
  private value;
  constructor(value: string) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

export class Decorator {
  private name: string | ImportName;
  private args: (string | Record<string, any>)[];

  constructor(name: string | ImportName) {
    this.name = name;
    this.args = [];
  }

  unquote(value: string) {
    return new UnQuotedString(value);
  }

  arg(arg: any, unquote = false) {
    if (typeof arg === "string" && unquote) {
      arg = this.unquote(arg);
    }
    this.args.push(arg);
    return this;
  }

  private emitString(file: CodeFile, arg: any) {
    // arrow function ?
    if (
      typeof arg !== "string" ||
      (arg.includes("=>") && arg.startsWith("("))
    ) {
      file.write(`${arg}`);
    } else {
      file.write(`"${arg}"`);
    }
  }

  private emitObject(file: CodeFile, arg: any) {
    const items = Object.entries(arg)
      .filter(([k, v]) => v !== null)
      .filter(([k, v]) => v !== undefined);

    if (items.length === 0) return;

    file.write("{ ");
    let count = 0;
    // let items = Object.entries(arg);
    for (const [name, value] of items) {
      if (count > 0 && count < items.length) file.write(", ");
      file.write(name);
      file.write(": ");
      if (value instanceof UnQuotedString) {
        file.write(value.toString());
      } else {
        if (typeof value !== "object") this.emitString(file, value);
        if (typeof value === "object") this.emitObject(file, value);
      }
      count += 1;
    }
    file.write(" }");
  }

  emit(file: CodeFile) {
    const { name, args } = this;

    file.write("@").write(name).write("(");

    let count = 0;

    for (const arg of args) {
      if (count > 0 && count < args.length) file.write(", ");
      if (typeof arg !== "object") this.emitString(file, arg);
      if (typeof arg === "object") this.emitObject(file, arg);
      count += 1;
    }

    file.write(")");
  }
}
