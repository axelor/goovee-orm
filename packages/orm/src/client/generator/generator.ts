import fs from "node:fs";
import path from "node:path";

import * as ts from "typescript";
import { camelCase } from "typeorm/util/StringUtils.js";

import { CodeFile } from "../../code-generator/CodeFile";
import { generateSchema } from "../../schema/schema-generator";
import { readSchema } from "../../schema/schema-utils";
import { EntityOptions } from "../../schema/types";
import { TranspileConfig } from "../types";

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

export const generateClient = (schemaDirs: string[], outDir: string) => {
  const modelsDir = path.join(outDir, "models");
  const clientDir = path.join(outDir, "client");

  const schema = schemaDirs.flatMap(readSchema);
  const files: string[] = [];
  const names = schema.map((x) => x.name);

  // check for duplicates
  const visited = new Set<string>();
  for (const name of names) {
    if (visited.has(name)) {
      throw new Error(`Duplicate entity found: ${name}`);
    }
    visited.add(name);
  }

  files.push(...generateSchema(modelsDir, { schema, naming: "goovee" }));

  createFile(clientDir, "index.ts", createClient(schema, names));

  files.push(path.join(clientDir, "index.ts"));

  return files;
};

const TS_COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  declaration: true,
  skipLibCheck: true,
  experimentalDecorators: true,
  emitDecoratorMetadata: true,
  useDefineForClassFields: true,
  allowJs: true,
  allowSyntheticDefaultImports: true,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  moduleDetection: ts.ModuleDetectionKind.Force,
  esModuleInterop: true,
  isolatedModules: true,
  lib: ["lib.es2022.d.ts"],
};

const TS_SCRIPT_TARGETS: Record<string, ts.ScriptTarget> = {
  es2017: ts.ScriptTarget.ES2017,
  es2018: ts.ScriptTarget.ES2019,
  es2019: ts.ScriptTarget.ES2019,
  es2020: ts.ScriptTarget.ES2020,
  es2021: ts.ScriptTarget.ES2021,
  es2022: ts.ScriptTarget.ES2022,
  es2023: ts.ScriptTarget.ES2023,
  es2024: ts.ScriptTarget.ES2024,
};

const TS_MODULE_TYPES: Record<string, ts.ModuleKind> = {
  commonjs: ts.ModuleKind.CommonJS,
  esnext: ts.ModuleKind.ESNext,
  nodenext: ts.ModuleKind.NodeNext,
};

function prepateCompilerOptions(options?: TranspileConfig) {
  const cfgFile = ts.findConfigFile(".", ts.sys.fileExists, "tsconfig.json");
  const cfg = cfgFile
    ? ts.readConfigFile(cfgFile, ts.sys.readFile).config || {}
    : {};

  const target = options?.target || cfg.target || "esnext";
  const type = options?.module || cfg.module || "nodenext";
  const lib: string[] = cfg.lib || [target];

  const opts: ts.CompilerOptions = { ...TS_COMPILER_OPTIONS };

  opts.module = TS_MODULE_TYPES[type] ?? ts.ModuleKind.ESNext;
  opts.target = TS_SCRIPT_TARGETS[target] ?? ts.ScriptTarget.ESNext;
  opts.lib = lib.map((x) => `lib.${x.toLowerCase()}.d.ts`);

  return opts;
}

export const transpileClient = (files: string[], options?: TranspileConfig) => {
  const opts = prepateCompilerOptions(options);
  const outputFiles: string[] = [];

  const filePaths = files.map((x) => path.resolve(x));

  const sourceCodes: Record<string, string> = {};
  const sourceFiles: Record<string, ts.SourceFile> = {};

  for (const filePath of filePaths) {
    const target = opts.target!;
    const code = fs.readFileSync(filePath, { encoding: "utf-8" }).toString();
    const source = ts.createSourceFile(filePath, code, target, true);
    sourceCodes[filePath] = code;
    sourceFiles[filePath] = source;
  }

  const host: ts.CompilerHost = {
    getSourceFile: (fileName) => sourceFiles[fileName] || undefined,
    writeFile: () => {},
    getCurrentDirectory: () => process.cwd(),
    getDirectories: () => [],
    fileExists: (fileName) => !!sourceFiles[fileName],
    readFile: (fileName) => sourceCodes[fileName],
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    getDefaultLibFileName: () => opts.lib![0],
  };

  const program = ts.createProgram(filePaths, opts, host);

  for (const sourceFile of Object.values(sourceFiles)) {
    const result = program.emit(sourceFile, (fileName, text) => {
      const base = path.basename(fileName);
      const dir = path.dirname(fileName);
      createFile(dir, base, text);
      outputFiles.push(fileName);
    });

    if (result.emitSkipped || !result) {
      console.warn(`Failed to compile file ${sourceFile.fileName}`);
    }
  }

  return outputFiles;
};
