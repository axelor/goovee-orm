import fs from "node:fs";
import path from "node:path";
import { camelCase } from "typeorm/util/StringUtils";

import pkg from "../../package.json";
import { CodeFile } from "../code-generator/CodeFile";
import { generateSchema } from "../schema/schema-generator";

const tsConfig = {
  compilerOptions: {
    lib: ["es5", "es6"],
    target: "es6",
    module: "commonjs",
    moduleResolution: "node",
    emitDecoratorMetadata: true,
    experimentalDecorators: true,
    declaration: true,
    declarationMap: true,
    outDir: "./dist",
    paths: {
      typeorm: ["../cms-core/node_modules/typeorm"],
    },
  },
  include: ["src"],
  exclude: ["node_modules"],
};

const packageJson = {
  name: "@goovee/cms-client",
  version: pkg.version,
  license: pkg.license,
  private: true,
  main: "./dist/index.js",
  types: "./dist/index.d.ts",
  dependencies: {
    "@goovee/orm": pkg.version,
    typeorm: pkg.dependencies.typeorm,
  },
  devDependencies: {
    "@types/node": pkg.devDependencies["@types/node"],
    typescript: pkg.devDependencies.typescript,
  },
};

const create = (outDir: string, fileName: string, content: any) => {
  const text =
    typeof content === "string" ? content : JSON.stringify(content, null, 2);
  const file = path.join(outDir, fileName);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(file, text, {
    encoding: "utf-8",
  });
  return fileName;
};

const createClient = (names: string[]) => {
  const file = new CodeFile("index.ts");

  file.write(`\
import {
  createClient as create,
  type ClientOptions,
  type ConnectionClient,
  type EntityClient,
} from "@goovee/orm/dist/client";

import {
`);

  for (const name of names) {
    file.write(`${name},`);
    file.write("\n");
  }
  file.write('} from "../entity";');
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

export const createClient = (options: ClientOptions): GooveeClient => create(options, entities);
`);

  return file.toJSON();
};

export const generateProject = (outDir: string) => {
  const files: string[] = [];

  files.push(create(outDir, "package.json", packageJson));
  files.push(create(outDir, "tsconfig.json", tsConfig));

  create(
    path.join(outDir, "src"),
    "index.ts",
    `
export * from "./entity";
export * from "./client";
`
  );

  files.push(path.join("src", "index.ts"));

  return files;
};

export const generateClient = (schemaDir: string, outDir: string) => {
  const entityDir = path.join(outDir, "src", "entity");
  const clientDir = path.join(outDir, "src", "client");

  const schema = fs
    .readdirSync(schemaDir, { withFileTypes: true })
    .filter((x) => /\.(ts|json)$/.test(x.name))
    .map((x) => path.join(schemaDir, x.name))
    .map((x) => path.resolve(x))
    .map((x) => (x.endsWith(".json") ? require(x) : require(x).default));

  const files: string[] = [];
  const names = schema.map((x) => x.name);

  files.push(...generateSchema(entityDir, schema));
  files.push(...generateProject(outDir));

  create(clientDir, "index.ts", createClient(names));
  files.push(path.join(clientDir, "index.ts"));

  return files;
};
