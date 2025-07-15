import fs from "node:fs";
import path from "node:path";
import { camelCase, snakeCase } from "typeorm/util/StringUtils.js";
import { EntityOptions } from "./types";

export const toSnakeCase = (name: string) => snakeCase(name);
export const toCamelCase = (name: string, firstUpper?: boolean) => {
  const res = camelCase(name);
  return firstUpper ? res[0].toUpperCase() + res.slice(1) : res;
};

export const defineEntity = (entity: EntityOptions) => entity;

export const readSchema = (schemaDir: string): EntityOptions[] => {
  const schema = fs
    .readdirSync(schemaDir, { withFileTypes: true })
    .filter((x) => /\.(json)$/.test(x.name))
    .map((x) => path.join(schemaDir, x.name))
    .map((x) => path.resolve(x))
    .map((x) => JSON.parse(fs.readFileSync(x, { encoding: "utf-8" })));
  return schema;
};
