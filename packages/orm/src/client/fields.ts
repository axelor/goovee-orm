import { Repository } from "typeorm";
import { createLob, readLob } from "./lob";

export type Json = string;
export type Text = string;
export type Binary = Promise<Buffer>;

export const isLob = (repo: Repository<any>, name: string) => {
  const column = repo.metadata.findColumnWithPropertyName(name);
  const type = column?.type as any;
  return type === "oid";
};

export const resolveLazy = async (
  repo: Repository<any>,
  target: any,
  name: string,
  value: any
) => {
  if (isLob(repo, name)) {
    return await createLob(repo.manager, await value);
  }
  return value;
};

export const ensureLazy = (
  repo: Repository<any>,
  target: any,
  name: string
) => {
  const symbol = Symbol(name);
  const initial = target[name];

  Object.defineProperty(target, name, {
    get() {
      return this[symbol] ?? (this[symbol] = loadLazy(repo, initial));
    },
    set(value: any) {
      this[symbol] = value;
    },
  });
};

export const loadLazy = (repo: Repository<any>, value: any) => {
  if (typeof value === "number") {
    return readLob(repo.manager, value);
  }
  return Promise.resolve(value);
};
