import { Command } from "commander";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { generate } from "./commands/generate";

const version = (() => {
  const pkg = join(__dirname, "..", "..", "package.json");
  const data = JSON.parse(readFileSync(pkg, { encoding: "utf-8" }));
  return data.version;
})();

const program = new Command();

program.name("goovee");
program.description("Goovee CLI");
program.version(version);

// add commands
program.addCommand(generate);

program.parse(process.argv);
