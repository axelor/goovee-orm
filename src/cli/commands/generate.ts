import fs from "node:fs";
import path from "node:path";

import { Command } from "commander";

import { generateClient, transpileClient } from "../../client/generator";
import type { TranspileConfig } from "../../client/types";
import { expandConfig, loadConfig } from "../config";

export function buildPackageJson(
  transpile: boolean | TranspileConfig,
): Record<string, unknown> {
  const opts =
    typeof transpile === "object" && transpile !== null ? transpile : {};
  return {
    name: opts.packageName ?? "@goovee/generated",
    version: "1.0.0",
    type: opts.module === "commonjs" ? "commonjs" : "module",
    exports: {
      "./models": "./models/index.js",
      "./client": "./client/index.js",
    },
  };
}

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
    const files = generateClient(dirs, outDir, {
      transpile: !!schema.transpile,
    });

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
      fs.writeFileSync(
        path.join(outDir, "package.json"),
        JSON.stringify(buildPackageJson(schema.transpile), null, 2) + "\n",
      );
    }
  });
