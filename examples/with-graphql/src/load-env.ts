import { config } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";

const envPath = join(process.cwd(), ".env");

if (existsSync(envPath)) {
  config({
    path: envPath,
    override: false,
    quiet: true,
  });
}
