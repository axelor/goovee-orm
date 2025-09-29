#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

if (process.env.NODE_OPTIONS?.includes("-r @swc-node/register")) {
  require("./index");
} else {
  spawnSync(process.argv[0], process.argv.slice(1), {
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, "-r", "@swc-node/register"]
        .filter(Boolean)
        .join(" "),
    },
  });
}
