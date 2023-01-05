import { CodeFile } from "./CodeFile";
import { Decorable } from "./Decorable";
import { Emittable } from "./Emittable";
import { Method, MethodOptions } from "./Method";
import { Variable, VariableOptions } from "./Variable";

export enum ContainerType {
  TYPE = "type",
  INTERFACE = "interface",
  ENUM = "enum",
  CLASS = "class",
}

export interface ContainerOptions {
  export?: boolean;
}

export abstract class Container<T extends ContainerOptions>
  extends Decorable
  implements Emittable
{
  private type;
  private name;
  protected opts;

  protected fields: Variable[] = [];
  protected methods: Method[] = [];

  constructor(type: ContainerType, name: string, options: T) {
    super();
    this.type = type;
    this.name = name;
    this.opts = options;
  }

  protected get memberSeperator() {
    return "\n";
  }

  field(field: string | Variable, options: VariableOptions = {}) {
    const opts = { ...options, field: true };
    const member =
      typeof field === "string" ? new Variable(field, opts) : field;
    this.fields.push(member);
    return member;
  }

  method(method: string | Method, options: MethodOptions = {}) {
    const opts = {
      arrow: this.type === "type",
      declaration: this.type !== "class",
      ...options,
    };
    const member =
      typeof method === "string" ? new Method(method, opts) : method;
    this.methods.push(member);
    return member;
  }

  protected emitModifiers(file: CodeFile) {}

  protected emitSuperTypes(file: CodeFile) {}

  protected emitBody(file: CodeFile) {
    const { fields, methods } = this;
    const members = [...fields, ...methods];
    file.write("{");
    if (members.length) {
      file.write("\n");
      let count = 0;
      for (const member of members) {
        member.emit(file);
        if (count++ < members.length - 1) {
          file.write(this.memberSeperator);
        }
      }
      file.write("\n");
    }
    file.write("}");
  }

  emit(file: CodeFile) {
    const { name, opts } = this;
    this.emitJsDoc(file);
    this.emitDecorators(file);
    if (opts.export) file.write("export ");
    this.emitModifiers(file);
    file.write(this.type).write(" ").write(name).write(" ");
    this.emitSuperTypes(file);
    this.emitBody(file);
  }
}
