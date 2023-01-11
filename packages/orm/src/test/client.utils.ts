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
  const { Title } = await import("./entity/Title");
  const { Country } = await import("./entity/Country");
  const { Address } = await import("./entity/Address");
  const { Contact } = await import("./entity/Contact");

  const entities = {
    title: Title,
    country: Country,
    address: Address,
    contact: Contact,
  };

  const options = {
    url: process.env.DATABASE_URL ?? "",
    sync: true,
  };

  return createClient(options, entities);
};
