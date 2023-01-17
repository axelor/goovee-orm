import { Repository } from "typeorm";
import { createLob, readLob } from "./lob";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | JsonType;
export type JsonType = {
  [K: string]: JsonValue;
};

export type Json = Promise<JsonType>;
export type Text = Promise<string>;
export type Binary = Promise<Buffer>;

export const isLazy = (
  repo: Repository<any>,
  name: string,
  expected?: string
) => {
  const field = name.replace("self.", "");
  const column = repo.metadata.findColumnWithPropertyName(field);
  const type = column?.type as any;
  return expected
    ? type === expected
    : type === "oid" || type === "jsonb" || type === "text";
};

export const resolveLazy = async (
  repo: Repository<any>,
  target: any,
  name: string,
  value: any
) => {
  if (isLazy(repo, name) && value) value = await value;
  if (isLazy(repo, name, "oid")) {
    return await createLob(repo.manager, value);
  }
  return value;
};

export const ensureLazy = (
  repo: Repository<any>,
  target: any,
  field: string
) => {
  const name = field.replace("self.", "");
  const symbol = Symbol(name);
  Object.defineProperty(target, name, {
    get() {
      return this[symbol] ?? (this[symbol] = loadLazy(repo, target, name));
    },
    set(value: any) {
      this[symbol] = value;
    },
  });
};

const loadLazy = async (repo: Repository<any>, target: any, name: string) => {
  const qb = repo
    .createQueryBuilder("self")
    .select(`self.${name}`)
    .where("self.id = :id", { id: target.id });

  const res = await qb.getOne();
  const value = res[name];

  return isLazy(repo, name, "oid")
    ? readLob(repo.manager, value)
    : Promise.resolve(value);
};
