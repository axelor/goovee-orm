import { CodeFile } from "./CodeFile";
import { Container, ContainerOptions, ContainerType } from "./Container";

export interface TypeOptions extends ContainerOptions {
  alias?: string;
}

export class Type extends Container<TypeOptions> {
  constructor(name: string, options: TypeOptions = {}) {
    super(ContainerType.TYPE, name, options);
  }

  protected emitBody(file: CodeFile): void {
    const { alias } = this.opts;
    file.write("=> ");
    if (alias) {
      file.write(alias);
    } else {
      super.emitBody(file);
    }
  }
}
