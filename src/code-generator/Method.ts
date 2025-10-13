import { CodeFile } from "./CodeFile";
import { Decorable } from "./Decorable";
import { Emittable } from "./Emittable";
import { ImportName } from "./ImportName";
import { Variable, VariableOptions } from "./Variable";

export interface MethodOptions {
  type?: string | ImportName;
  typeArgs?: string[];
  visibility?: "private" | "protected";
  abstract?: boolean;
  getter?: boolean;
  setter?: boolean;
  arrow?: boolean | string;
  declaration?: boolean;
  modifier?: "function" | "const";
  async?: boolean;
}

export class Method extends Decorable implements Emittable {
  private name;
  private opts;
  private args: Variable[] = [];
  private body: string[] = [];

  constructor(name: string, options: MethodOptions = {}) {
    super();
    this.name = name;
    this.opts = options;
  }

  param(name: string | Variable, options: VariableOptions = {}) {
    const param = typeof name === "string" ? new Variable(name) : name;
    param.merge(options);
    this.args.push(param);
    return this;
  }

  line(line: string) {
    this.body.push(line);
  }

  emit(file: CodeFile) {
    const { name, opts, args } = this;
    const { modifier, declaration } = opts;
    const arrow = modifier === "const" || opts.arrow;

    if (!arrow) {
      this.emitJsDoc(file);
      this.emitDecorators(file);
      if (opts.visibility) file.write(opts.visibility).write(" ");
      if (opts.abstract) file.write("abstract ");
      if (opts.getter) file.write("get ");
      if (opts.setter) file.write("set ");
      if (opts.async) file.write("async ");
    }

    if (modifier) file.write(modifier).write(" ");
    if ((modifier && arrow) || !arrow) {
      file.write(name);
    }

    if (modifier && arrow) file.write(" = ");
    if (opts.async && arrow) file.write("async ");

    if (opts.typeArgs?.length) {
      file.write("<");
      file.write(opts.typeArgs.join(", "));
      file.write(">");
    }

    file.write("(");

    let argCount = 0;
    for (const arg of args) {
      arg.emit(file);
      if (argCount < args.length - 1) {
        file.write(", ");
      }
      argCount++;
    }

    file.write(")");

    if (opts.type)
      file.write(declaration && arrow ? " => " : ": ").write(opts.type);

    // typescript declaration only
    if (declaration) {
      file.write(";");
      return;
    }

    const block = !arrow || (arrow && this.body.length > 1);

    if (arrow) {
      file.write(" => ");
      if (typeof opts.arrow === "string") {
        file.write(opts.arrow);
      } else if (!this.body.length && !block) {
        file.write("{}");
      }
      return;
    }

    if (block) file.write(" {");

    if (this.body.length) {
      if (block) file.write("\n");
      for (const line of this.body) {
        file.write(line);
        if (block) file.write("\n");
      }
    }

    if (block) file.write("}");
  }
}
