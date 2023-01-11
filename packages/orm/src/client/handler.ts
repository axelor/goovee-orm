import {
  EntityManager,
  EntityMetadata,
  QueryBuilder,
  Repository,
} from "typeorm";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata";
import { parseQuery, ParseResult } from "./parser";
import { DeleteOptions, ID, QueryOptions } from "./types";

const relationQuery = (manager: EntityManager, relation: RelationMetadata) => {
  const entityTable = relation.entityMetadata.tableName;
  const targetTable = relation.inverseEntityMetadata.tableName;

  const mappedBy = relation.inverseRelation?.joinColumns?.[0]?.databaseName;

  const joinTable = relation.joinTableName;
  const joinColumn = relation.joinColumns?.[0]?.databaseName;
  const inverseJoinColumn = relation.inverseJoinColumns?.[0]?.databaseName;

  if (relation.isManyToOne || relation.isOneToOne) {
    return manager
      .createQueryBuilder()
      .from(targetTable, "self")
      .select("self.id")
      .addSelect("self.version")
      .innerJoin(entityTable, "joined", `joined.${joinColumn} = self.id`)
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

  if (relation.isManyToMany) {
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

  throw new Error(`Invalid relation: ${relation.propertyName}`);
};

const load = async (
  repo: Repository<any>,
  builder: QueryBuilder<any>,
  options: ParseResult
) => {
  const {
    select = {},
    where,
    params = {},
    joins = {},
    references = {},
    collections = {},
    take,
    skip,
    cursor,
  } = options;

  const sq = builder.select("self.id").addSelect("self.version");

  Object.entries(select)
    .filter(([name]) => name !== "self.id" && name !== "self.version")
    .forEach(([name, alias]) => sq.addSelect(name, alias));

  Object.entries(joins).forEach(([name, alias]) => sq.leftJoin(name, alias));

  if (where) sq.andWhere(where, params);

  if (take) sq.take(parseInt(`${take}`));
  if (skip) sq.skip(parseInt(`${skip}`));

  const records = await sq.getMany();

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
      if (value && relation.isManyToOne) {
        attrs[name] = await handleReference(repo, relation, value);
      }
    } else {
      attrs[name] = value;
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

export const handleUpdate = async (
  repo: Repository<any>,
  data: Record<string, any>
) => {
  const { id, version, ...rest } = data;
  // first check if record exists with same version
  const obj = await repo.findOne({
    where: { id },
    lock: {
      mode: "optimistic",
      version: version,
    },
  });

  const meta = repo.metadata;
  const attrs: Record<string, any> = {};

  for (const [name, value] of Object.entries(rest)) {
    const relation = meta.findRelationWithPropertyPath(name);
    if (relation && value) {
      if (relation.isManyToOne) {
        const item = await handleReference(repo, relation, value);
        if (item !== undefined) {
          attrs[name] = item;
        }
      }
      if (relation.isOneToMany || relation.isManyToMany) {
        await handleCollection(repo, obj, relation, value);
      }
    } else {
      attrs[name] = value;
    }
  }

  const changed = Object.keys(attrs).some((x) => attrs[x] !== obj[x]);
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

  const link = inverseField ? { [inverseField]: obj } : {};

  const builder = repo.createQueryBuilder().relation(field).of(obj);

  if (create) {
    for (const item of create) {
      const res = await handleCreate(rRepo, { ...item, ...link });
      builder.add(res);
    }
  }

  if (select) {
    for (const where of select) {
      const item = await handleSelect(rRepo, where);
      if (item) {
        builder.addAndRemove(item, item);
      }
    }
  }

  if (update) {
    for (const attrs of update) {
      const item = await handleUpdate(rRepo, attrs);
      if (item) {
        builder.addAndRemove(item, item);
      }
    }
  }
};
