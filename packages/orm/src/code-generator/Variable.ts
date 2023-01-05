import { CodeFile } from "./CodeFile";
import { Decorable } from "./Decorable";
import { Emittable } from "./Emittable";
import { ImportName } from "./ImportName";

export interface VariableOptions {
  type?: string | ImportName;
  value?: any;
  field?: boolean;
  modifier?: "readonly" | "const" | "var" | "let";
  required?: boolean;
  quote?: boolean;
}

export class Variable extends Decorable implements Emittable {
  #name;
  private opts;

  constructor(name: string, options: VariableOptions = {}) {
    super();
    this.#name = name;
    this.opts = options;
  }

  get name() {
    return this.#name;
  }

  get value() {
    return this.opts.value;
  }

  emit(file: CodeFile) {
    const { name } = this;
    const { type, value, quote, modifier, required, field } = this.opts;

    this.emitJsDoc(file);
    this.emitDecorators(file, field ? "\n" : " ");

    if (modifier) file.write(modifier).write(" ");
    if (name) file.write(name);
    if (required) {
      if (value === void 0 && field) file.write("!");
    } else {
      if (field || (value === void 0 && !name.startsWith("...")))
        file.write("?");
    }
    if (type) file.write(": ").write(type);
    if (value !== void 0) {
      file.write(" = ");
      if (type === "string" || quote) {
        file.write(JSON.stringify(value));
      } else {
        file.write(`${value}`);
      }
    }
    if (field) file.write(";");
  }
}
