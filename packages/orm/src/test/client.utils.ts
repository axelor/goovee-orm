import path from "node:path";
import { generateClient } from "../client/client-generator";

export const generateCode = () => {
  const schemaDir = path.join(__dirname, "schema");
  const clientDir = path.join(__dirname, "db");
  generateClient(schemaDir, clientDir);
};

const createTestClient = async () => {
  const { createClient } = await import("./db/client/index.js");
  const url = process.env.DATABASE_URL;
  if (url === undefined) {
    throw new Error("No DATABASE_URL environment set");
  }

  return createClient({ url, sync: true });
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
