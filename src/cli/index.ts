import { Command } from "commander";
import { generate } from "./commands/generate";
import packageJson from "../../package.json" with { type: "json" };

const version = packageJson.version;

const program = new Command();

program.name("goovee");
program.description("Goovee CLI");
program.version(version);

// add commands
program.addCommand(generate);

program.parse(process.argv);
