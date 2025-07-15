import {
  EntityManager,
  EntityMetadata,
  QueryBuilder,
  Repository as OrmRepository,
  SelectQueryBuilder,
} from "typeorm";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata";
import { ensureLazy, isLazy, resolveLazy } from "./fields";
import {
  createCursor,
  isPageQuery,
  parseCursor,
  parseQuery,
  ParseResult,
} from "./parser";

import type {
  BulkDeleteOptions,
  BulkUpdateOptions,
  CreateOptions,
  DeleteOptions,
  Entity,
  ID,
  Middleware,
  MiddlewareArgs,
  Options,
  Payload,
  QueryClient,
  QueryOptions,
  Repository,
  UpdateOptions,
  WhereOptions,
} from "./types";

const relationQuery = (manager: EntityManager, relation: RelationMetadata) => {
  const entityTable = relation.entityMetadata.tableName;
  const targetTable = relation.inverseEntityMetadata.tableName;

  const mappedBy = relation.inverseRelation?.joinColumns?.[0]?.databaseName;

  const joinTable = relation.joinTableName;
  const joinColumn = relation.joinColumns?.[0]?.databaseName;
  const inverseJoinColumn = relation.inverseJoinColumns?.[0]?.databaseName;

  if (relation.isManyToOne || (relation.isOneToOne && joinColumn)) {
    return manager
      .createQueryBuilder()
      .from(targetTable, "self")
      .select("self.id")
      .addSelect("self.version")
      .innerJoin(entityTable, "joined", `joined.${joinColumn} = self.id`)
      .where("joined.id = :__parent");
  }

  if (relation.isOneToOne && !joinColumn) {
    return manager
      .createQueryBuilder()
      .from(targetTable, "self")
      .select("self.id")
      .addSelect("self.version")
      .innerJoin(entityTable, "joined", `joined.id = self.${mappedBy}`)
      .where("joined.id = :__parent");
  }

  if (relation.isOneToMany) {
    return manager
      .createQueryBuilder()
      .from(targetTable, "self")
      .select("self.id")
      .addSelect("self.version")
      .where(`self.${mappedBy} = :__parent`);
  }

  // owner side many-to-many
  if (relation.isManyToMany && joinColumn) {
    return manager
      .createQueryBuilder()
      .from(targetTable, "self")
      .select("self.id")
      .addSelect("self.version")
      .innerJoin(
        joinTable,
        "joined",
        `joined.${joinColumn} = :__parent AND joined.${inverseJoinColumn} = self.id`,
      );
  }

  // non-owning side many-to-many
  if (relation.isManyToMany && relation.inverseRelation && mappedBy) {
    const inverse = relation.inverseRelation;
    const joinTable = inverse.joinTableName;
    const inverseJoinColumn = inverse.inverseJoinColumns?.[0].databaseName;
    return manager
      .createQueryBuilder()
      .from(targetTable, "self")
      .select("self.id")
      .addSelect("self.version")
      .innerJoin(
        joinTable,
        "joined",
        `joined.${mappedBy} = self.id AND joined.${inverseJoinColumn} = :__parent`,
      );
  }

  throw new Error(`Invalid relation: ${relation.propertyName}`);
};

const createSelectQuery = <T extends Entity>(
  builder: QueryBuilder<T>,
  options: ParseResult,
) => {
  const { select, where, params = {}, joins = {}, order } = options;

  const sq = select
    ? builder.select("self.id").addSelect("self.version")
    : builder.select();

  Object.entries(select ?? {})
    .filter(([name]) => name !== "self.id" && name !== "self.version")
    .forEach(([name, alias]) => sq.addSelect(name, alias));

  Object.entries(joins).forEach(([name, alias]) => sq.leftJoin(name, alias));

  if (where) sq.andWhere(where, params);
  if (order) sq.orderBy(order);

  return sq;
};

const createBulkQuery = <T extends Entity>(
  client: QueryClient,
  repo: OrmRepository<T>,
  where?: WhereOptions<T>,
) => {
  const opts = parseQuery(client, repo, { where });
  const qb = repo.createQueryBuilder("self");
  const sq = createSelectQuery(qb, opts);
  return sq;
};

const load = async (
  repo: OrmRepository<any>,
  builder: QueryBuilder<any>,
  options: ParseResult,
) => {
  const { references = {}, collections = {}, select = {} } = options;

  const lazyFields = Object.keys(select).filter((x) => isLazy(repo, x));
  const normalSelect = Object.entries(select)
    .filter(([x]) => !lazyFields.includes(x))
    .reduce((prev, [k, v]) => ({ ...prev, [k]: v }), {});

  const opts = options.select ? { ...options, select: normalSelect } : options;
  const sq = createSelectQuery(builder, opts);

  let count = -1;
  let { take = 0, skip = 0, cursor } = options;
  if (isPageQuery(options)) {
    count = await sq.getCount();
    skip = take >= 0 || cursor ? skip : count - skip + take;
    take = Math.abs(take);
  }

  if (count === 0) {
    return [];
  }

  if (take > 0) sq.take(take);
  if (skip > 0) sq.skip(skip);

  if (cursor) {
    const cur = parseCursor(options);
    if (cur.where) {
      sq.andWhere(cur.where, cur.params);
    }
    if (cur.order) {
      // when fetching previous page with a cursor we have to invert
      // the original ordering first to get required data and finally
      // return the result with the requested order.
      const sub = new SelectQueryBuilder(sq).orderBy(cur.order);
      const res = await sub.getMany();
      const ids = res.map((x) => x.id);
      if (ids.length === 0) return [];
      sq.where("self.id IN (:...ids)", { ids }).take(undefined).skip(undefined);
    }
  }

  const { entities: records, raw: rawRecords } = await sq.getRawAndEntities();

  const relations = [
    ...Object.entries(references),
    ...Object.entries(collections),
  ];

  for (const [property, opts] of relations) {
    const relation = repo.metadata.findRelationWithPropertyPath(property);
    if (!relation) {
      throw new Error(
        `No such relation exits: ${repo.metadata.name}#${property}`,
      );
    }

    const rq = relationQuery(repo.manager, relation);
    const rr = repo.manager.getRepository(relation.inverseEntityMetadata.name);

    for (const record of records) {
      const nq = rq.clone().setParameter("__parent", record.id);
      const related = await load(rr, nq, opts);
      record[property] =
        property in references
          ? related && related.length
            ? related[0]
            : null
          : related;
    }
  }

  // handle lazy fields
  for (const field of lazyFields) {
    for (const record of records) {
      ensureLazy(repo, record, field);
    }
  }

  // enhance record with count and cursor
  if (isPageQuery(options)) {
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rawRecord = rawRecords[i];
      const cur = createCursor(options, rawRecord);
      record._count = count;
      record._cursor = cur;
    }

    const start = records[0];
    const startCursor = start?._cursor;
    const end = records[records.length - 1];
    const endCursor = end?._cursor;

    const has = async (cursor: string, take: number) => {
      const qb = repo.createQueryBuilder("self");
      const opts = { ...options, cursor, take, skip: 0 };
      const res = await load(repo, qb, opts);
      return res.length === 1;
    };

    if (start)
      start._hasPrev = count > 1 && startCursor && (await has(startCursor, -1));
    if (end) end._hasNext = count > 1 && endCursor && (await has(endCursor, 1));
  }

  return records;
};

const isValueSame = (a: any, b: any): boolean => {
  if (a === null || a === undefined) a = null;
  if (b === null || b === undefined) b = null;
  if (a === b) return true;
  if (a === null || b === null) return false;

  if (a instanceof Date && b instanceof Date) {
    return a.toISOString() === b.toISOString();
  }

  if (a instanceof Buffer && b instanceof Buffer) {
    return a.equals(b);
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => isValueSame(v, b[i]));
  }

  if (typeof a === "object" && typeof b === "object") {
    if ("id" in a && "id" in b) {
      if ("version" in a && "version" in b) {
        return a.id === b.id && a.version === b.version;
      }
      return a.id === b.id;
    }
  }

  return a === b;
};

const valueOrID = (value: any) =>
  value && typeof value === "object" && "id" in value ? value.id : value;

export class EntityRepository<T extends Entity> implements Repository<T> {
  #repo: OrmRepository<T>;
  #client: QueryClient;
  #interceptor: Interceptor;

  constructor(
    repo: OrmRepository<T>,
    client: QueryClient,
    interceptor: Interceptor,
  ) {
    this.#repo = repo;
    this.#client = client;
    this.#interceptor = interceptor;
  }

  get name() {
    return this.#repo.metadata.name;
  }

  unwrap() {
    return this.#repo;
  }

  async intercept(
    method: string,
    args: any,
    next: () => Promise<any>,
  ): Promise<any> {
    const params: MiddlewareArgs = {
      client: this.#client,
      source: this,
      method,
      args,
    };
    return await this.#interceptor.execute(params, next);
  }

  @intercept()
  async find<U extends QueryOptions<T>>(
    args?: Options<U, QueryOptions<T>>,
  ): Promise<Payload<T, U>[]> {
    const client = this.#client;
    const repo = this.#repo;
    const opts = parseQuery(client, repo, args ?? {});
    const qb = repo.createQueryBuilder("self");
    const result = await load(repo, qb, opts);
    return result;
  }

  async findOne<U extends QueryOptions<T>>(
    args?: Options<U, QueryOptions<T>>,
  ): Promise<Payload<T, U> | null> {
    const result = await this.find({
      ...args,
      take: 1,
      skip: 0,
    });
    return result.length ? (result[0] as Payload<T, U>) : null;
  }

  @intercept()
  async count(args?: QueryOptions<T>): Promise<ID> {
    const client = this.#client;
    const repo = this.#repo;
    const opts = parseQuery(client, repo, args ?? {});
    const qb = repo.createQueryBuilder("self");
    const sq = createSelectQuery(qb, opts);
    return await sq.getCount();
  }

  private async handleReference(
    repo: OrmRepository<any>,
    relation: RelationMetadata,
    data: any,
  ) {
    // we will get arrays from graphql input
    const select = Array.isArray(data.select) ? data.select[0] : data.select;
    const create = Array.isArray(data.create) ? data.create[0] : data.create;
    const update = Array.isArray(data.update) ? data.update[0] : data.update;

    const rMeta = relation.inverseEntityMetadata;
    const rRepo = repo.manager.getRepository(rMeta.name);

    const ref = new EntityRepository(rRepo, this.#client, this.#interceptor);

    if (select) {
      const res = await ref.findOne({ where: select });
      if (res) return res;
    }

    if (create) {
      return await ref.create({ data: create });
    }

    if (update) {
      return await ref.update({ data: update });
    }
  }

  async handleCollection(
    repo: OrmRepository<any>,
    obj: any,
    relation: RelationMetadata,
    data: any,
  ) {
    const { select, create, update, remove } = data;
    const field = relation.propertyName;
    const inverseField = relation.inverseRelation?.propertyName;
    const rMeta = relation.inverseEntityMetadata;
    const rRepo = repo.manager.getRepository(rMeta.name);

    const link = inverseField
      ? { [inverseField]: { select: { id: obj.id } } }
      : {};

    const builder = repo.createQueryBuilder().relation(field).of(obj);

    const selectAll = Array.isArray(select) ? select : [select];
    const createAll = Array.isArray(create) ? create : [create];
    const updateAll = Array.isArray(update) ? update : [update];
    const removeAll = Array.isArray(remove) ? remove : [remove];

    const ref = new EntityRepository(rRepo, this.#client, this.#interceptor);

    // we are removing relationship, not necessarily the record
    if (remove) {
      for (const id of removeAll) {
        await builder.remove(id);
      }
    }

    if (create) {
      for (const item of createAll) {
        const res = await ref.create({ data: { ...item, ...link } });
        if (!inverseField) {
          await builder.add(res);
        }
      }
    }

    if (select) {
      for (const where of selectAll) {
        const item = await ref.findOne({ where });
        if (item) {
          await builder.addAndRemove(item, item);
        }
      }
    }

    if (update) {
      for (const attrs of updateAll) {
        const item = await ref.update({ data: attrs });
        if (item) {
          await builder.addAndRemove(item, item);
        }
      }
    }
  }

  @intercept()
  async create<U extends CreateOptions<T>>(
    args: Options<U, CreateOptions<T>>,
  ): Promise<Payload<T, U>> {
    const repo: any = this.#repo;
    const meta: EntityMetadata = repo.metadata;
    const attrs: Record<string, any> = {};

    const { select, data } = args;

    // first handle single value fields
    for (const [name, value] of Object.entries(data)) {
      const relation = meta.findRelationWithPropertyPath(name);
      if (relation) {
        if (value && (relation.isManyToOne || relation.isOneToOne)) {
          attrs[name] = await this.handleReference(repo, relation, value);
        }
      } else {
        attrs[name] = await resolveLazy(repo, {}, name, value);
      }
    }

    // save
    const obj = await repo.save(repo.create(attrs));

    // now handle collection fields
    for (const [name, value] of Object.entries(data)) {
      const relation = meta.findRelationWithPropertyPath(name);
      if (value && (relation?.isOneToMany || relation?.isManyToMany)) {
        await this.handleCollection(repo, obj, relation, value);
      }
    }

    // now load the selection
    const res = this.findOne({
      select,
      where: { id: obj.id },
    });

    return res as any;
  }

  @intercept()
  async update<U extends UpdateOptions<T>>(
    args: Options<U, UpdateOptions<T>>,
  ): Promise<Payload<T, U>> {
    const repo: any = this.#repo;
    const { select, data } = args;
    const { id, version, ...rest } = data;

    const meta = repo.metadata;
    const attrs: Record<string, any> = {};

    // load existing single value fields
    const relations: Record<string, any> = {};
    const selection: Record<string, any> = {
      id: true,
      version: true,
    };

    for (const [name, value] of Object.entries(rest)) {
      const relation = meta.findRelationWithPropertyPath(name);
      if (relation?.isOneToMany || relation?.isManyToMany) {
        continue;
      }
      if (relation && value) {
        selection[name] = { id: true, version: true };
        relations[name] = true;
      } else {
        selection[name] = true;
      }
    }

    // first check if record exists with same version
    const obj = await repo.findOne({
      select: selection,
      relations,
      where: { id },
      lock: {
        mode: "optimistic",
        version: version,
      },
    });

    for (const [name, value] of Object.entries(rest)) {
      const relation = meta.findRelationWithPropertyPath(name);
      if (relation && value) {
        if (relation.isManyToOne) {
          const item = await this.handleReference(repo, relation, value);
          if (!isValueSame(item, obj[name])) {
            attrs[name] = item;
          }
        }
        if (relation.isOneToMany || relation.isManyToMany) {
          await this.handleCollection(repo, obj, relation, value);
        }
      } else {
        attrs[name] = await resolveLazy(repo, obj, name, value);
      }
    }

    const changed = Object.keys(attrs).some(
      (x) => !isValueSame(attrs[x], obj[x]),
    );

    if (changed) {
      Object.assign(obj, attrs);
      await repo.save(obj);
    }

    // now load the selection
    const found = this.findOne({
      select,
      where: { id: obj.id },
    });

    return found as any;
  }

  @intercept()
  async delete(args: DeleteOptions<T>): Promise<ID> {
    const repo: any = this.#repo;
    const { id, version } = args;

    // check version
    await repo.findOne({
      select: { id: true, version: true },
      where: { id },
      lock: {
        mode: "optimistic",
        version,
      },
    });

    const result = await repo.delete(id);
    return result.affected ?? 0;
  }

  @intercept()
  async updateAll(args: BulkUpdateOptions<T>): Promise<ID> {
    const client = this.#client;
    const repo = this.#repo;
    const { set, where } = args;
    const qb = createBulkQuery(client, repo, where);
    const updateSet = Object.entries(set).reduce(
      (prev, [k, v]) => ({ ...prev, [k]: valueOrID(v) }),
      {},
    );
    const { affected } = await qb.update(updateSet).execute();
    return affected ?? 0;
  }

  @intercept()
  async deleteAll(args?: BulkDeleteOptions<T>): Promise<ID> {
    const client = this.#client;
    const repo = this.#repo;
    const { where } = args ?? {};
    const qb = createBulkQuery(client, repo, where);

    // https://github.com/typeorm/typeorm/issues/5931
    const [query, params] = qb.select("self.id").getQueryAndParameters();

    // PostgreSQL doesn't support JOIN in DELETE query
    const raw = `DELETE FROM "${repo.metadata.tableName}" "me" WHERE "me"."id" IN (${query})`;

    const [_, affected] = await repo.manager.query(raw, params);

    return affected ?? 0;
  }
}

export function intercept() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;
    descriptor.value = async function (...params: any[]) {
      const execute = target.intercept;
      const res = execute
        ? execute.call(this, propertyKey, params, () =>
            method.apply(this, params),
          )
        : method.apply(this, params);
      return res;
    };
    return descriptor;
  };
}

export class Interceptor {
  #middlewares: Middleware[] = [];

  push(...middleware: Middleware[]) {
    this.#middlewares.push(...middleware);
  }

  async execute<T>(args: MiddlewareArgs, cb: () => Promise<any>): Promise<any> {
    let stack: Middleware[] = [...this.#middlewares, cb];
    let index = -1;
    let next = async (): Promise<any> => {
      let func = stack[++index];
      if (func) {
        return await func(args, next);
      }
    };
    return await next();
  }
}
