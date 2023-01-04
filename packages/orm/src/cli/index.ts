import yargs from "yargs";
import dotenv from "dotenv";
dotenv.config();

yargs
  .usage("Usage: $0 <command> [options]")
  .scriptName("goovee")
  .strict()
  .recommendCommands()
  .demandCommand(1)
  .help().argv;
