import yargs from "yargs";

import { GenerateCommand } from "./commands/GenerateCommand";

yargs
  .usage("Usage: $0 <command> [options]")
  .scriptName("goovee")
  .command(GenerateCommand)
  .strict()
  .recommendCommands()
  .demandCommand(1)
  .help().argv;
