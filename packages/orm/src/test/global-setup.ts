import "reflect-metadata";
import { generateCode } from "./client.utils";
import { createPostgresContainer } from "./pg-container";

export async function setup() {
  // generate code
  generateCode();

  // create pg container
  const pg = await createPostgresContainer();

  process.env.DATABASE_URL = pg.url;

  return async () => {
    await pg.stop();
  };
}
