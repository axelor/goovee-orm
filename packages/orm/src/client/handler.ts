import {
  EntityManager,
  EntityMetadata,
  QueryBuilder,
  Repository,
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
import {
  BulkDeleteOptions,
  BulkUpdateOptions,
  DeleteOptions,
  ID,
  QueryOptions,
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
        `joined.${joinColumn} = :__parent AND joined.${inverseJoinColumn} = self.id`
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
        `joined.${mappedBy} = self.id AND joined.${inverseJoinColumn} = :__parent`
      );
  }

  throw new Error(`Invalid relation: ${relation.propertyName}`);
};

const createSelectQuery = (
  builder: QueryBuilder<any>,
  options: ParseResult
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

const load = async (
  repo: Repository<any>,
  builder: QueryBuilder<any>,
  options: ParseResult
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
        `No such relation exits: ${repo.metadata.name}#${property}`
      );
    }

    const rq = relationQuery(repo.manager, relation);
    const rr = repo.manager.getRepository(relation.inverseEntityMetadata.name);

    for (const record of records) {
      rq.setParameter("__parent", record.id);
      const related = await load(rr, rq, opts);
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

    start._hasPrev = count > 1 && startCursor && (await has(startCursor, -1));
    end._hasNext = count > 1 && endCursor && (await has(endCursor, 1));
  }

  return records;
};

export const handleFindMany = async (
  repo: Repository<any>,
  args: QueryOptions<any>
) => {
  const opts = parseQuery(repo, args);
  const qb = repo.createQueryBuilder("self");
  const result = await load(repo, qb, opts);
  return result;
};

export const handleFindOne = async (
  repo: Repository<any>,
  args: QueryOptions<any>
) => {
  const result = await handleFindMany(repo, {
    ...args,
    take: 1,
    skip: 0,
  });
  return result?.[0] ?? null;
};

export const handleCount = async (
  repo: Repository<any>,
  args: QueryOptions<any>
) => {
  const opts = parseQuery(repo, args);
  const qb = repo.createQueryBuilder("self");
  const sq = createSelectQuery(qb, opts);
  return await sq.getCount();
};

export const handleCreate = async (
  repo: Repository<any>,
  data: Record<string, any>
) => {
  const meta: EntityMetadata = repo.metadata;
  const attrs: Record<string, any> = {};

  // first handle single value fields
  for (const [name, value] of Object.entries(data)) {
    const relation = meta.findRelationWithPropertyPath(name);
    if (relation) {
      if (value && (relation.isManyToOne || relation.isOneToOne)) {
        attrs[name] = await handleReference(repo, relation, value);
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
      await handleCollection(repo, obj, relation, value);
    }
  }

  return obj;
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
      return a.id === b.id;
    }
  }

  return a === b;
};

export const handleUpdate = async (
  repo: Repository<any>,
  data: Record<string, any>
) => {
  const { id, version, ...rest } = data;

  const meta = repo.metadata;
  const attrs: Record<string, any> = {};

  const relations: Record<string, any> = {};
  const select: Record<string, any> = {
    id: true,
    version: true,
  };

  for (const [name, value] of Object.entries(rest)) {
    const relation = meta.findRelationWithPropertyPath(name);
    if (relation?.isOneToMany || relation?.isManyToMany) {
      continue;
    }
    if (relation && value) {
      select[name] = { id: true };
      relations[name] = true;
    } else {
      select[name] = true;
    }
  }

  // first check if record exists with same version
  const obj = await repo.findOne({
    select,
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
        const item = await handleReference(repo, relation, value);
        if (!isValueSame(item, obj[name])) {
          attrs[name] = item;
        }
      }
      if (relation.isOneToMany || relation.isManyToMany) {
        await handleCollection(repo, obj, relation, value);
      }
    } else {
      attrs[name] = await resolveLazy(repo, obj, name, value);
    }
  }

  const changed = Object.keys(attrs).some(
    (x) => !isValueSame(attrs[x], obj[x])
  );

  if (!changed) {
    return obj;
  }

  Object.assign(obj, attrs);
  const res = await repo.save(obj);

  // check version again
  await repo.findOne({
    where: { id },
    lock: {
      mode: "optimistic",
      version: version + 1, // it should be incremented by 1 only
    },
  });

  return res;
};

export const handleDelete = async (
  repo: Repository<any>,
  data: DeleteOptions<any>
): Promise<ID> => {
  const { id, version } = data;

  // check version
  await repo.findOne({
    select: {
      id: true,
      version: true,
    },
    where: { id },
    lock: {
      mode: "optimistic",
      version,
    },
  });

  const result = await repo.delete(id);
  return result.affected ?? 0;
};

const handleSelect = async (repo: Repository<any>, data: any) => {
  const res = await repo.findOne({
    where: data,
  });
  return res;
};

const handleReference = async (
  repo: Repository<any>,
  relation: RelationMetadata,
  data: any
) => {
  const { select, create, update } = data;
  const rMeta = relation.inverseEntityMetadata;
  const rRepo = repo.manager.getRepository(rMeta.name);

  if (select) {
    const res = await handleSelect(rRepo, select);
    if (res) return res;
  }

  if (create) {
    return await handleCreate(rRepo, create);
  }

  if (update) {
    return await handleUpdate(rRepo, update);
  }
};

const handleCollection = async (
  repo: Repository<any>,
  obj: any,
  relation: RelationMetadata,
  data: any
) => {
  const { select, create, update } = data;
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

  if (create) {
    for (const item of createAll) {
      const res = await handleCreate(rRepo, { ...item, ...link });
      if (!inverseField) {
        await builder.add(res);
      }
    }
  }

  if (select) {
    for (const where of selectAll) {
      const item = await handleSelect(rRepo, where);
      if (item) {
        await builder.addAndRemove(item, item);
      }
    }
  }

  if (update) {
    for (const attrs of updateAll) {
      const item = await handleUpdate(rRepo, attrs);
      if (item) {
        await builder.addAndRemove(item, item);
      }
    }
  }
};

const createBulkQuery = (repo: Repository<any>, where?: WhereOptions<any>) => {
  const opts = parseQuery(repo, { where });
  const qb = repo.createQueryBuilder("self");
  const sq = createSelectQuery(qb, opts);
  return sq;
};

const valueOrID = (value: any) =>
  value && typeof value === "object" && "id" in value ? value.id : value;

export const handleBulkUpdate = async (
  repo: Repository<any>,
  data: BulkUpdateOptions<any>
): Promise<ID> => {
  const { set, where } = data;
  const qb = createBulkQuery(repo, where);
  const updateSet = Object.entries(set).reduce(
    (prev, [k, v]) => ({ ...prev, [k]: valueOrID(v) }),
    {}
  );
  const { affected } = await qb.update(updateSet).execute();
  return affected ?? 0;
};

export const handleBulkDelete = async (
  repo: Repository<any>,
  data: BulkDeleteOptions<any>
): Promise<ID> => {
  const { where } = data;
  const qb = createBulkQuery(repo, where);

  // https://github.com/typeorm/typeorm/issues/5931
  const [query, params] = qb.select("self.id").getQueryAndParameters();

  // PostgreSQL doesn't support JOIN in DELETE query
  const raw = `DELETE FROM "${repo.metadata.tableName}" "me" WHERE "me"."id" IN (${query})`;

  const [_, affected] = await repo.manager.query(raw, params);

  return affected ?? 0;
};
