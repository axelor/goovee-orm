import fs from "node:fs";
import path from "node:path";

import { createClient } from "../client";
import { generateSchema, readSchema } from "../schema/schema-generator";

export const generateCode = () => {
  const schemaDir = path.join(__dirname, "schema");
  const entityDir = path.join(__dirname, "entity");
  if (!fs.existsSync(path.join(entityDir, "Contact.ts"))) {
    generateSchema(entityDir, readSchema(schemaDir));
  }
};

export const createTestClient = async () => {
  const { Title, Country, Circle, Address, Contact } = await import("./entity");

  const entities = {
    title: Title,
    country: Country,
    circle: Circle,
    address: Address,
    contact: Contact,
  };

  const options = {
    url: process.env.DATABASE_URL ?? "",
    sync: true,
  };

  return createClient(options, entities);
};

export type TestClient = ReturnType<typeof createTestClient> extends Promise<
  infer T
>
  ? T
  : never;

let client: TestClient;

export const getTestClient = async () => {
  return client ?? (client = await createTestClient());
};
