import fs from "node:fs";
import path from "node:path";

import pkg from "../../package.json";
import { generateSchema } from "../schema/schema-generator";

const tsConfig = {
  compilerOptions: {
    module: "commonjs",
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    target: "esnext",
  },
  exclude: ["node_modules"],
};

const packageJson = {
  name: "@goovee/cms-client",
  version: pkg.version,
  license: pkg.license,
  private: true,
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

export const generateProject = (outDir: string) => {
  const files: string[] = [];

  files.push(create(outDir, "package.json", packageJson));
  files.push(create(outDir, "tsconfig.json", tsConfig));

  return files;
};

export const generateClient = (schemaDir: string, outDir: string) => {
  const entityDir = path.join(outDir, "src", "entity");
  const schema = fs
    .readdirSync(schemaDir, { withFileTypes: true })
    .filter((x) => /\.(ts|json)$/.test(x.name))
    .map((x) => path.join(schemaDir, x.name))
    .map((x) => path.resolve(x))
    .map((x) => (x.endsWith(".json") ? require(x) : require(x).default));

  const files: string[] = [];

  files.push(...generateProject(outDir));
  files.push(...generateSchema(entityDir, schema));

  return files;
};
