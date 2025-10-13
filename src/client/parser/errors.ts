export class ParserError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, any>,
  ) {
    super(message);
    this.name = "ParserError";
  }
}

export class InvalidJsonFilterError extends ParserError {
  constructor(filter: any) {
    super(`Invalid JSON filter: ${JSON.stringify(filter)}`, { filter });
  }
}
