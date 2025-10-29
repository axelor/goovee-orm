import { config as loadDotenv } from "dotenv";
import { existsSync } from "fs";
import path from "path";

/**
 * Loads .env files with Next.js-style precedence:
 * 1. .env.local
 * 2. .env
 *
 * Later files do NOT override previously loaded variables.
 */
function loadEnv(cwd: string = process.cwd()) {
  const dotenvFiles = [".env.local", ".env"];

  for (const file of dotenvFiles) {
    const fullPath = path.join(cwd, file);
    if (existsSync(fullPath)) {
      loadDotenv({ path: fullPath, override: false }); // Do not override already loaded values
    }
  }
}

loadEnv();
