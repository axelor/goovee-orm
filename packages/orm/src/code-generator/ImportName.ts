import { CodeFile } from "./CodeFile";
import { Emittable } from "./Emittable";

const PATTERN = /(type\s+)?(?<name>\w+)(\s+as\s+(?<alias>\w+))?/;

export const findName = (statement: string) => {
  const match = PATTERN.exec(statement);
  if (match && match.groups) {
    return match.groups["alias"] ?? match.groups["name"];
  }
  return statement;
};

export class ImportName implements Emittable {
  #name;
  #module;
  #statement;

  constructor(name: string, module: string) {
    this.#statement = name;
    this.#module = module;
    this.#name = findName(name);
  }

  get name() {
    return this.#name;
  }

  emit(file: CodeFile): void {
    if (this.#module) {
      file.importName(this.#statement, this.#module);
    }
    file.write(this.#name);
  }
}
