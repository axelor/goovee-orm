import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { glob } from "glob";

import type { GooveeConfig, SchemaConfig } from "../../client/types";

export function loadConfig(file?: string): GooveeConfig {
  const defaultPath = path.join(process.cwd(), "goovee.config.json");
  const configPath = file || defaultPath;

  if (!fs.existsSync(configPath)) {
    if (file) {
      throw new Error(`No such file found: ${file}`);
    }
    return {};
  }

  try {
    const content = fs.readFileSync(configPath, { encoding: "utf-8" });
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file: ${configPath}`);
    }
    throw error;
  }
}

function findDefaultSchemaConfig(): SchemaConfig {
  const dir1 = path.join(".", "goovee", "schema");
  const dir2 = path.join(".", "src", "goovee", "schema");
  const dir = fs.existsSync(dir2) ? dir2 : dir1;
  const outDir = path.join(path.dirname(dir), ".generated");
  return {
    dirs: [dir],
    outDir,
  };
}

export function expandConfig(config: GooveeConfig): GooveeConfig {
  const schema = config.schema ?? {};
  const defaultSchema = findDefaultSchemaConfig();

  const outDir = schema.outDir || defaultSchema.outDir;
  const dirs = schema.dirs?.length
    ? glob.sync(schema.dirs, { absolute: true })
    : defaultSchema.dirs;

  return {
    ...config,
    schema: {
      ...schema,
      dirs,
      outDir,
    },
  };
}
