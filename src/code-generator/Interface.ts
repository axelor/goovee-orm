import { CodeFile } from "./CodeFile";
import { Container, ContainerOptions, ContainerType } from "./Container";
import { ImportName } from "./ImportName";

export interface InterfaceOptions extends ContainerOptions {
  extends?: (string | ImportName)[];
}

export class Interface extends Container<InterfaceOptions> {
  constructor(name: string, options: InterfaceOptions) {
    super(ContainerType.INTERFACE, name, options);
  }

  protected emitSuperTypes(file: CodeFile): void {
    const opts = this.opts;
    if (opts.extends?.length) {
      file.write("extends ");
      let count = 0;
      for (const type of opts.extends) {
        file.write(type);
        if (++count < opts.extends.length) {
          file.write(", ");
        }
      }
      file.write(" ");
    }
  }
}
