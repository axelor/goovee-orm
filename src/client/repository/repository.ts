import { DeepPartial, EntityMetadata } from "typeorm";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata.js";
import { resolveLazy } from "../fields/utils";
import { parseAggregate, parseQuery } from "../parser";
import type {
  AggregateOptions,
  AggregatePayload,
  BulkCreateOptions,
  BulkDeleteOptions,
  BulkUpdateOptions,
  CreateArgs,
  CreateOptions,
  CreatePayload,
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
import { getSimpleSelect } from "../parser/processors/select-processor";

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
      // if id is null, we want to set the reference to null
      if (select.id === null && Object.keys(select).length === 1) {
        return null;
      }
      const res = await ref.findOne({ where: select });
      if (!res) {
        throw new Error(
          `Referenced ${rMeta.name} not found with criteria: ${JSON.stringify(
            select,
          )}`,
        );
      }
      return res;
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

    if (remove && (select || update)) {
      const removeIds = new Set(removeAll.filter((id) => id != null));
      const selectIds = select
        ? selectAll.map((s) => s.id).filter((id) => id != null)
        : [];
      const updateIds = update
        ? updateAll.map((u) => u.id).filter((id) => id != null)
        : [];

      for (const id of [...selectIds, ...updateIds]) {
        if (removeIds.has(id)) {
          throw new Error(
            `Conflicting operations on ${rMeta.name}: ` +
              `cannot remove and update/select the same item (id: ${id})`,
          );
        }
      }
    }

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
        if (!item) {
          throw new Error(
            `Referenced ${rMeta.name} not found with criteria: ${JSON.stringify(
              where,
            )}`,
          );
        }
        await builder.addAndRemove(item, item);
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

  async #handleCreate<T extends Entity>(
    repo: OrmRepository<T>,
    meta: EntityMetadata,
    data: CreateArgs<T>,
  ) {
    const attrs: Record<string, any> = {};

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

    // create entity
    return repo.create(attrs as DeepPartial<T>);
  }

  async #handleCreateCollections(
    repo: OrmRepository<T>,
    meta: EntityMetadata,
    obj: T,
    data: CreateArgs<T>,
  ) {
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
  }

  @intercept()
  async create<U extends CreateOptions<T>>(
    args: Options<U, CreateOptions<T>>,
  ): Promise<CreatePayload<T, U>> {
    const repo: any = this.#repo;
    const meta: EntityMetadata = repo.metadata;

    const { select, data } = args;

    // prepare
    const attrs = await this.#handleCreate(repo, meta, data);

    // save
    const obj = await repo.save(attrs);

    // handle collections
    await this.#handleCreateCollections(repo, meta, obj, data);

    // use simple select if no selection is given
    const selection = select ?? (getSimpleSelect(repo) as U["select"]);

    // load the selection
    const res = this.findOne({
      select: selection,
      where: { id: obj.id },
    });

    return res as any;
  }

  #findForUpdate = async (
    id: ID,
    version: number,
    options?: {
      select?: Record<string, any>;
      relations?: Record<string, any>;
    },
  ) => {
    const repo: any = this.#repo;
    const meta = repo.metadata;

    if (id === null || id === undefined) {
      throw new Error("Operation requires valid `id`.");
    }

    if (version === null || version === undefined) {
      throw new Error("Operation requires valid `version`.");
    }

    const relations = options?.relations;
    const select = {
      ...options?.select,
      id: true,
      version: true,
    };

    const obj = await repo.findOne({
      select,
      relations,
      where: { id },
      lock: {
        mode: "optimistic",
        version,
      },
    });

    if (obj) {
      return obj;
    }

    throw new Error(
      `Optimistic lock failed: ${meta.name} with id ${id} not found or ` +
        `has been modified (expected version ${version})`,
    );
  };

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

    const obj = await this.#findForUpdate(id, version, {
      select: selection,
      relations,
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

    // Optimistic lock check
    await this.#findForUpdate(id, version);

    const result = await repo.delete(id);
    return result.affected ?? 0;
  }

  @intercept()
  async createAll<U extends BulkCreateOptions<T>>(
    args: Options<U, BulkCreateOptions<T>>,
  ): Promise<CreatePayload<T, U>[]> {
    const repo: any = this.#repo;
    const meta: EntityMetadata = repo.metadata;
    const { select, data } = args;

    // early return
    if (data == null || data.length === 0) {
      return [];
    }

    // prepare all items
    const objects = await Promise.all(
      data.map((item) => this.#handleCreate(repo, meta, item)),
    );

    // save them all
    const objs: T[] = await repo.save(objects);

    // now handle collections
    await Promise.all(
      objs.map((obj, index) =>
        this.#handleCreateCollections(repo, meta, obj, data[index]),
      ),
    );

    // use simple select if no selection is given
    const selection = select ?? (getSimpleSelect(repo) as U["select"]);

    // load the selection
    const ids = objs.map((obj) => obj.id!);
    const res = await this.find({
      select: selection,
      where: {
        id: { in: ids },
      } as any,
    });

    return res as any;
  }

  @intercept()
  async updateAll(args: BulkUpdateOptions<T>): Promise<ID> {
    const client = this.#client;
    const repo = this.#repo;
    const meta = repo.metadata;
    const { set, where } = args;
    const qb = createBulkQuery(client, repo, where);
    const updateSet: Record<string, any> = Object.entries(set).reduce(
      (prev, [k, v]) => ({ ...prev, [k]: valueOrID(v) }),
      {},
    );

    const { versionColumn, updateDateColumn } = meta;

    if (versionColumn) {
      updateSet[versionColumn.propertyName] = () =>
        `"${versionColumn.databaseName}" + 1`;
    }

    if (updateDateColumn) {
      updateSet[updateDateColumn.propertyName] = new Date();
    }

    // Similar issue as in deleteAll, we cannot do JOIN in UPDATE
    const ub = repo
      .createQueryBuilder("me")
      .select("me.id")
      .whereExists(qb.andWhere(`self.id = ${repo.metadata.tableName}."id"`));

    const { affected } = await ub.update(updateSet).execute();
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
