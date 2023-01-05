import { CodeFile } from "./CodeFile";
import { Decorator } from "./Decorator";
import { Doc } from "./Doc";

export abstract class Decorable {
  protected decorators: Decorator[] = [];
  protected jsdoc: string[] = [];

  decorator(decorator: string | Decorator, ...args: any[]) {
    if (typeof decorator === "string") {
      const dec = new Decorator(decorator);
      args.forEach((arg) => dec.arg(arg));
      this.decorators.push(dec);
      return dec;
    } else {
      this.decorators.push(decorator);
    }
    return decorator;
  }

  doc(line: string) {
    this.jsdoc.push(line);
  }

  protected emitDecorators(file: CodeFile, sep = "\n") {
    for (const decorator of this.decorators) {
      decorator.emit(file);
      file.write(sep);
    }
  }

  protected emitJsDoc(file: CodeFile) {
    const { jsdoc } = this;
    if (jsdoc.length) {
      const doc = new Doc(...jsdoc);
      doc.emit(file);
    }
  }
}
