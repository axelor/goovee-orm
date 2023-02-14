import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { GenerateCommand } from "./commands/GenerateCommand";

const yarg = yargs(hideBin(process.argv));

// Yargs stored version number
yarg.version("1.0.0");

yarg
  .usage("Usage: $0 <command> [options]")
  .scriptName("goovee")
  .command(GenerateCommand)
  .strict()
  .recommendCommands()
  .demandCommand(1)
  .help().argv;
