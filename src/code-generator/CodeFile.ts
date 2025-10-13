import fs from "node:fs";
import path from "node:path";

import { CodeWriter } from "./CodeWriter";
import { ImportName } from "./ImportName";

export class CodeFile {
  private imports: Record<string, Set<string>> = {};
  private writer: CodeWriter = new CodeWriter();

  readonly fileName;
  readonly fileDir;

  constructor(fileName: string) {
    this.fileName = fileName;
    this.fileDir = path.dirname(fileName);
  }

  resolve(relativeName: string) {
    return path.join(this.fileDir, relativeName);
  }

  importName(name: string, module: string) {
    const ns = this.imports[module] ?? (this.imports[module] = new Set());
    ns.add(name);

    const res = /(type\s+)?(?<name>\w+)(\s+as\s+(?<alias>\w+))?/.exec(name);
    if (res && res.groups) {
      return res.groups["alias"] ?? res.groups["name"];
    }

    return name;
  }

  write(code: string | ImportName) {
    if (typeof code !== "string" && code) {
      code.emit(this);
    } else {
      this.writer.write(code);
    }
    return this;
  }

  toJSON() {
    const iw = new CodeWriter();
    const tw = new CodeWriter();

    for (const [module, names] of Object.entries(this.imports)) {
      iw.write(`import { ${[...names].join(", ")} } from "${module}";`);
      iw.write("\n");
    }

    let code = iw.toJSON() + "\n\n" + tw.toJSON();

    code = code.trim() + "\n\n" + this.writer.toJSON();
    return code.trim() + "\n";
  }

  saveSync() {
    const code = this.toJSON();
    const dir = path.dirname(this.fileName);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.fileName, code, {
      encoding: "utf-8",
    });
  }
}
