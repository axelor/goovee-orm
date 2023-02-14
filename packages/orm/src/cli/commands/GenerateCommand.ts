import fs from "node:fs";
import path from "node:path";

import { CommandModule } from "yargs";
import { generateClient } from "../../client/client-generator";

export const GenerateCommand: CommandModule = {
  command: "generate",
  describe: "Generate entity types and client from the schema",
  handler: (args) => {
    const searchPaths = [
      path.join(".", "src", "goovee", "schema"),
      path.join(".", "goovee", "schema"),
    ];

    const schemaDir = searchPaths.find((x) => fs.existsSync(x));
    if (!schemaDir || !fs.existsSync(schemaDir)) {
      console.error(`Schema directory doesn't exists`);
      process.exit(1);
    }

    const clientDir = path.join(path.dirname(schemaDir), ".generated");

    // generate client
    generateClient(schemaDir, clientDir);
  },
};
