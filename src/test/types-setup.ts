import { generateCode } from "./client.utils";

// The type tests import the generated test client (`./db/models`), which is
// not committed — generate it up front, like the e2e setup does, but without
// the database container: only tsc consumes the result.
export function setup() {
  generateCode();
}
