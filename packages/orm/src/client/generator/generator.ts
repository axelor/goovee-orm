import fs from "node:fs";
import path from "node:path";
import { camelCase } from "typeorm/util/StringUtils";

import { CodeFile } from "../../code-generator/CodeFile";
import { generateSchema } from "../../schema/schema-generator";
import { readSchema } from "../../schema/schema-utils";
import { EntityOptions } from "../../schema/types";

export const createFile = (outDir: string, fileName: string, content: any) => {
  const text =
    typeof content === "string" ? content : JSON.stringify(content, null, 2);
  const file = path.join(outDir, fileName);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(file, text, {
    encoding: "utf-8",
  });
  return fileName;
};

const createClient = (schema: EntityOptions[], names: string[]) => {
  const file = new CodeFile("index.ts");
  const pkgName = "@goovee/orm";
  file.write(`\
import {
  createClient as create,
  type ClientOptions,
  type ConnectionClient,
  type EntityClient,
} from "${pkgName}";

import { buildGraphQLSchema } from "${pkgName}";
import { type EntityOptions } from "${pkgName}";
import { type GraphQLSchema } from "graphql";

import {
`);

  for (const name of names) {
    file.write(`${name},`);
    file.write("\n");
  }
  file.write('} from "../models";');
  file.write("\n");
  file.write("\n");

  file.write("const schemaDefs: EntityOptions[] = [");
  file.write("\n");
  for (const item of schema) {
    file.write(JSON.stringify(item)).write(",");
    file.write("\n");
  }
  file.write("];");
  file.write("\n");
  file.write("\n");

  file.write("const entities = {");
  file.write("\n");
  for (const name of names) {
    file.write(`${camelCase(name)}: ${name},`);
    file.write("\n");
  }
  file.write("};");
  file.write("\n");

  file.write(`
export type Client = EntityClient<typeof entities>;
export type GooveeClient = ConnectionClient<Client>;

export function createClient(options: ClientOptions = {}): GooveeClient {
  const { url = process.env.DATABASE_URL ?? "" } = options;
  if (url) {
    return create({ ...options, url }, entities, schemaDefs);
  }
  throw new Error("No 'DATABASE_URL' environment variable defined.");
};

export function createSchema(): GraphQLSchema {
  return  buildGraphQLSchema(schemaDefs);
}
`);

  return file.toJSON();
};

export const generateClient = (schemaDir: string, outDir: string) => {
  const modelsDir = path.join(outDir, "models");
  const clientDir = path.join(outDir, "client");

  const schema = readSchema(schemaDir);
  const files: string[] = [];
  const names = schema.map((x) => x.name);

  files.push(...generateSchema(modelsDir, { schema, naming: "goovee" }));

  createFile(clientDir, "index.ts", createClient(schema, names));
  files.push(path.join(clientDir, "index.ts"));

  return files;
};
