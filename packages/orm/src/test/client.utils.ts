import fs from "node:fs";
import path from "node:path";

import { createClient } from "../client";
import { generateSchema, readSchema } from "../schema/schema-generator";

const getLastChangeTime = (dir: string) => {
  if (fs.existsSync(dir)) {
    const mtimes = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((x) => x.name.endsWith(".ts") || x.name.endsWith(".json"))
      .map((x) => fs.statSync(path.join(dir, x.name)).mtimeMs);
    return mtimes.length ? Math.max(...mtimes) : 0;
  }
  return 0;
};

export const generateCode = () => {
  const schemaDir = path.join(__dirname, "schema");
  const entityDir = path.join(__dirname, "entity");

  const lastGenerateTime = getLastChangeTime(entityDir);
  const lastChangeTime = getLastChangeTime(schemaDir);

  const pkg = require("../../package.json");
  const pkgName = `${pkg.name}/client`;

  const resolve = (value: string) =>
    value === pkgName ? "../../client" : value;

  if (lastChangeTime > lastGenerateTime) {
    const schema = readSchema(schemaDir);
    generateSchema(entityDir, { schema, naming: "goovee", resolve });
  }
};

export const createTestClient = async () => {
  const { Bio, Title, Country, Circle, Address, Contact } = await import(
    "./entity"
  );

  const entities = {
    bio: Bio,
    title: Title,
    country: Country,
    circle: Circle,
    address: Address,
    contact: Contact,
  };

  const url = process.env.DATABASE_URL;
  if (url === undefined) {
    throw new Error("No DATABASE_URL environment set");
  }

  return createClient({ url, sync: true }, entities);
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
