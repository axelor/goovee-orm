import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { CommandModule } from "yargs";
import { generateClient } from "../../client/client-generator";

export const GenerateCommand: CommandModule = {
  command: "generate",
  describe: "Generate entity types and client from the schema",
  handler: (args) => {
    const schemaDir = path.join(".", "schema");
    const clientDir = path.join("node_modules", "@goovee", "cms-client");

    if (!fs.existsSync(schemaDir)) {
      console.error(`Schema directory doesn't exists`);
      process.exit(1);
    }

    // generate client
    generateClient(schemaDir, clientDir);

    // transpile
    const cmd = path.join(
      "..",
      "..",
      ".bin",
      process.platform === "win32" ? "tsc.cmd" : "tsc"
    );
    const tsc = spawn(cmd, ["-p", "tsconfig.json"], {
      cwd: clientDir,
    });

    tsc.stdout.pipe(process.stdout);
  },
};
