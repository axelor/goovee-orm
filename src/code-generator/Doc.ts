import { CodeFile } from "./CodeFile";
import { Emittable } from "./Emittable";

export class Doc implements Emittable {
  private lines;

  constructor(...lines: string[]) {
    this.lines = lines.flatMap((line) => this.toLines(line));
  }

  private toLines(line: string) {
    return line
      .trim()
      .split(/\n/g)
      .map((x) => x.trim());
  }

  line(line: string) {
    this.lines.push(...this.toLines(line));
  }

  emit(file: CodeFile) {
    const { lines } = this;
    if (lines.length) {
      file.write("/**").write("\n");
      for (const line of lines) {
        file.write(" *");
        if (line && line !== "\n") {
          file.write(" ");
          file.write(line);
        }
        file.write("\n");
      }
      file.write(" */").write("\n");
    }
  }
}
