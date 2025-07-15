import {
  EntityManager,
  QueryBuilder,
} from "typeorm";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata";
import { parseQuery, ParseResult } from "../../parser";
import type { Entity, QueryClient, WhereOptions } from "../../types";
import { OrmRepository } from "../types";

export const relationQuery = (manager: EntityManager, relation: RelationMetadata) => {
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

export const createSelectQuery = <T extends Entity>(
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

export const createBulkQuery = <T extends Entity>(
  client: QueryClient,
  repo: OrmRepository<T>,
  where?: WhereOptions<T>,
) => {
  const opts = parseQuery(client, repo, { where });
  const qb = repo.createQueryBuilder("self");
  const sq = createSelectQuery(qb, opts);
  return sq;
};
