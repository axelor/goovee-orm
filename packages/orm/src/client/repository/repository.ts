import { EntityMetadata } from "typeorm";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata.js";
import { resolveLazy } from "../fields/utils";
import { parseAggregate, parseQuery } from "../parser";
import type {
  AggregateOptions,
  AggregatePayload,
  BulkDeleteOptions,
  BulkUpdateOptions,
  CreateOptions,
  DeleteOptions,
  Entity,
  ID,
  MiddlewareArgs,
  Options,
  Payload,
  QueryClient,
  QueryOptions,
  Repository,
  UpdateOptions,
} from "../types";
import { intercept, Interceptor } from "./middleware";
import {
  createBulkQuery,
  createSelectQuery,
  runAggregate,
  runQuery,
} from "./query";
import { OrmRepository } from "./types";
import { isValueSame, valueOrID } from "./utils";

class RelationHandlers {
  static async handleReference(
    repo: OrmRepository<any>,
    relation: RelationMetadata,
    data: any,
    client: QueryClient,
    interceptor: Interceptor,
  ) {
    // we will get arrays from graphql input
    const select = Array.isArray(data.select) ? data.select[0] : data.select;
    const create = Array.isArray(data.create) ? data.create[0] : data.create;
    const update = Array.isArray(data.update) ? data.update[0] : data.update;

    const rMeta = relation.inverseEntityMetadata;
    const rRepo = repo.manager.getRepository(rMeta.name);

    // Import EntityRepository here to avoid circular dependency
    const { EntityRepository } = await import("./repository");
    const ref = new EntityRepository(rRepo, client, interceptor);

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

  static async handleCollection(
    repo: OrmRepository<any>,
    obj: any,
    relation: RelationMetadata,
    data: any,
    client: QueryClient,
    interceptor: Interceptor,
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

    // Import EntityRepository here to avoid circular dependency
    const { EntityRepository } = await import("./repository");
    const ref = new EntityRepository(rRepo, client, interceptor);

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
}

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
    const result = await runQuery(repo, qb, opts);
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

  @intercept()
  async aggregate<U extends AggregateOptions<T>>(
    args: Options<U, AggregateOptions<T>>,
  ): Promise<AggregatePayload<T, U>[]> {
    const client = this.#client;
    const repo = this.#repo;
    const opts = parseAggregate(client, repo, args ?? {});
    const result = await runAggregate(repo, opts);
    return result;
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
          attrs[name] = await RelationHandlers.handleReference(
            repo,
            relation,
            value,
            this.#client,
            this.#interceptor,
          );
        }
      } else {
        attrs[name] = await resolveLazy(repo, {}, name, value);
      }
    }

    // handle audit fields
    if (meta.createDateColumn) {
      attrs[meta.createDateColumn.propertyName] = new Date();
    }
    if (meta.updateDateColumn) {
      attrs[meta.updateDateColumn.propertyName] = new Date();
    }

    // save
    const obj = await repo.save(repo.create(attrs));

    // now handle collection fields
    for (const [name, value] of Object.entries(data)) {
      const relation = meta.findRelationWithPropertyPath(name);
      if (value && (relation?.isOneToMany || relation?.isManyToMany)) {
        await RelationHandlers.handleCollection(
          repo,
          obj,
          relation,
          value,
          this.#client,
          this.#interceptor,
        );
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
          const item = await RelationHandlers.handleReference(
            repo,
            relation,
            value,
            this.#client,
            this.#interceptor,
          );
          if (!isValueSame(item, obj[name])) {
            attrs[name] = item;
          }
        }
        if (relation.isOneToMany || relation.isManyToMany) {
          await RelationHandlers.handleCollection(
            repo,
            obj,
            relation,
            value,
            this.#client,
            this.#interceptor,
          );
        }
      } else {
        attrs[name] = await resolveLazy(repo, obj, name, value);
      }
    }

    const changed = Object.keys(attrs).some(
      (x) => !isValueSame(attrs[x], obj[x]),
    );

    if (changed) {
      if (meta.updateDateColumn) {
        attrs[meta.updateDateColumn.propertyName] = new Date();
      }
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
