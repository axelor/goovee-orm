import "reflect-metadata";
import { PostgreSqlContainer } from "testcontainers";
import { generateCode } from "./client.utils";

export async function setup() {
  // generate code
  generateCode();

  // create pg container
  const pg = await new PostgreSqlContainer()
    .withUsername("test")
    .withPassword("test")
    .withDatabase("test")
    .withExposedPorts(5432)
    .start();

  process.env.DATABASE_URL = `postgres://test:test@localhost:${pg.getPort()}/test`;

  return async () => {
    await pg.stop();
  };
}
