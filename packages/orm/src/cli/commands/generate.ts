import fs from "node:fs";
import path from "node:path";

import { Command } from "commander";
import { generateClient } from "../../client/client-generator";

export const generate = new Command()
  .name("generate")
  .description("Generate goovee client from the schema")
  .action(() => {
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

    // delete old files
    fs.rmSync(clientDir, { recursive: true, force: true });

    // generate client
    generateClient(schemaDir, clientDir);
  });
