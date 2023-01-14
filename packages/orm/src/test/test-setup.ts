import "reflect-metadata";
import { afterEach, beforeEach } from "vitest";
import { getTestClient } from "./client.utils";

beforeEach(async () => {
  const client = await getTestClient();
  await client.$connect();
  await client.$sync(true);
});
afterEach(async () => {
  const client = await getTestClient();
  await client.$disconnect();
});
