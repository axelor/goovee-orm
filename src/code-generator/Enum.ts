import { CodeFile } from "./CodeFile";
import { Container, ContainerOptions, ContainerType } from "./Container";

export interface EnumOptions extends ContainerOptions {}

export class Enum extends Container<EnumOptions> {
  constructor(name: string, options: EnumOptions = {}) {
    super(ContainerType.ENUM, name, options);
  }

  enum(name: string, value?: number | string) {
    this.field(name, {
      value,
    });
  }

  protected emitBody(file: CodeFile) {
    file.write("{");
    if (this.fields.length) {
      file.write("\n");
      let count = 0;
      for (const field of this.fields) {
        file.write(field.name);
        if (field.value !== void 0) {
          file.write(" = ");
          if (typeof field.value === "number") {
            file.write(`${field.value}`);
          } else {
            file.write(JSON.stringify(field.value));
          }
        }
        if (count++ < this.fields.length - 1) {
          file.write(",");
          file.write("\n");
        }
      }
      file.write("\n");
    }
    file.write("}");
  }
}
