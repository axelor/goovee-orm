#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(import.meta.url);
const scriptDir = dirname(script);

const runSelf = () => {
  const cwd = dirname(dirname(scriptDir));
  const cmd = process.env.npm_execpath;
  const env = {
    ...process.env,
    APP_CWD: process.cwd(),
  };
  const args = ["ts-node", script, ...process.argv.slice(2)];
  spawnSync(cmd, args, {
    env,
    cwd,
    stdio: "inherit",
    windowsHide: true,
  });
};

const runScript = () => {
  const cwd = process.env.APP_CWD;
  const cmd = process.env.npm_node_execpath;
  const script = join(scriptDir, "index.ts");
  const args = [process.argv[0], script, ...process.argv.slice(2)];
  spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    windowsHide: true,
  });
};

if (process.env.APP_CWD) {
  runScript();
} else {
  runSelf();
}
