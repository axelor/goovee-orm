import { CodeFile } from "./CodeFile";
import { Container, ContainerOptions, ContainerType } from "./Container";
import { ImportName } from "./ImportName";

export interface ClassOptions extends ContainerOptions {
  abstract?: boolean;
  extends?: string | ImportName;
  implements?: (string | ImportName)[];
}

export class Class extends Container<ClassOptions> {
  constructor(name: string, options: ClassOptions = {}) {
    super(ContainerType.CLASS, name, options);
  }

  protected get memberSeperator() {
    return "\n\n";
  }

  protected emitModifiers(file: CodeFile) {
    const { opts } = this;
    if (opts.abstract) file.write("abstract ");
  }

  protected emitSuperTypes(file: CodeFile) {
    const { opts } = this;
    if (opts.extends) file.write("extends ").write(opts.extends).write(" ");
    if (opts.implements?.length) {
      file.write("implements ");
      let count = 0;
      for (const type of opts.implements) {
        file.write(type);
        if (count++ < opts.implements.length - 1) {
          file.write(", ");
        }
      }
      file.write(" ");
    }
  }
}
