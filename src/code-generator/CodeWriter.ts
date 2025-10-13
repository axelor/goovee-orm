export class CodeWriter {
  private code: string = "";
  private lastTail = "";
  private indentLevel = 0;
  private indentWith;
  private indentBlockStart;
  private indentBlockEnd;

  constructor({
    indentWith = "  ",
    indentBlockStart = ["{", "(", "["],
    indentBlockEnd = ["}", ")", "]"],
  } = {}) {
    this.indentWith = indentWith;
    this.indentBlockStart = indentBlockStart;
    this.indentBlockEnd = indentBlockEnd;
  }

  private isBlockStart(text: string) {
    return text && this.indentBlockStart.some((x) => x === text);
  }

  private isBlockEnd(text: string) {
    return text && this.indentBlockEnd.some((x) => x === text);
  }

  private put(text: string) {
    if (text.length === 0) return;

    const line = text === "\n" ? text : text.trim();

    const head = line[0];
    const tail = line[line.length - 1];
    const lastTail = this.lastTail;

    const isBlockStart = text === "\n" && this.isBlockStart(lastTail);
    const isBlockEnd = lastTail === "\n" && this.isBlockEnd(head);

    if (isBlockStart) this.indentLevel += 1;
    if (isBlockEnd && this.indentLevel > 0) this.indentLevel -= 1;

    if (lastTail === "\n" && text !== "\n") {
      this.code += this.indentWith.repeat(this.indentLevel);
    }

    this.code += text;
    this.lastTail = tail;
  }

  write(code: string) {
    const [first, ...lines] = code.split(/\n/g);
    this.put(first);
    for (const line of lines) {
      this.put("\n");
      this.put(line.trim());
    }
  }

  toJSON() {
    return this.code;
  }
}
