#!/usr/bin/env node

import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const base = path.dirname(fileURLToPath(import.meta.url));

const NODE_PATH = process.env.NODE_PATH;
const cmd = path.join(NODE_PATH, ".bin", "ts-node");
const cli = path.join(base, "index.ts");

spawnSync(cmd, [cli, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
  windowsHide: true,
});
