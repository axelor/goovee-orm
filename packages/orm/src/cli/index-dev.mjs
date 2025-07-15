#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const tsNode = fileURLToPath(import.meta.resolve("ts-node/dist/bin"));

const scriptDir = dirname(fileURLToPath(import.meta.url));
const script = join(scriptDir, "index.ts");

const cmd = process.argv[0];
const args = [tsNode, script, ...process.argv.slice(2)];

spawnSync(cmd, args, {
  stdio: "inherit",
  windowsHide: true,
});
