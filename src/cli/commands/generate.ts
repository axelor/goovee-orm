import fs from "node:fs";

import { Command } from "commander";

import { generateClient, transpileClient } from "../../client/generator";
import { expandConfig, loadConfig } from "../config";

export const generate = new Command()
  .name("generate")
  .description("Generate goovee client from the schema")
  .action(() => {
    const configRaw = loadConfig();
    const config = expandConfig(configRaw);
    const schema = config.schema ?? {};

    const dirs = schema.dirs!;
    const outDir = schema.outDir!;

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        console.error(`Schema directory doesn't exists: ${dir}`);
        process.exit(1);
      }
    }

    // delete old files
    if (schema.clean) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }

    // generate client
    const files = generateClient(dirs, outDir);

    // transpile client?
    if (schema?.transpile) {
      const opts =
        typeof schema.transpile === "object" ? schema.transpile : undefined;
      // transpile
      transpileClient(files, opts);
      // remove typescript files
      for (const file of files) {
        fs.rmSync(file, { force: true });
      }
    }
  });
