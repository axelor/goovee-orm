import {
  FieldNode,
  getNamedType,
  GraphQLFieldResolver,
  GraphQLObjectType,
  GraphQLType,
  isObjectType,
  Kind,
} from "graphql";

import {
  ConnectionClient,
  CreateOptions,
  Entity,
  OrderByOptions,
  QueryClient,
  WhereOptions,
} from "../client";

import { toCamelCase } from "../schema/schema-utils";

export type ResolverSource = Entity & {
  [K: string]: any;
};

export type ResolverContext = {
  client: ConnectionClient<QueryClient>;
};

export type ResolverArgs = {
  where?: WhereOptions<ResolverSource>;
  order?: OrderByOptions<ResolverSource>;
  first?: number;
  after?: string;
  last?: number;
  before?: string;
};

const isConnection = (type: GraphQLType) => {
  return isObjectType(type) && type.name.endsWith("Connection");
};

const findField = (type: GraphQLObjectType, name: string) => {
  const fields = type.getFields();
  const field = fields[name];
  return field;
};

const findOutputType = (type: GraphQLObjectType) => {
  const edges = findField(type, "edges");
  if (edges) {
    const edge = getNamedType(edges.type) as GraphQLObjectType;
    const node = findField(edge, "node");
    return getNamedType(node.type) as GraphQLObjectType;
  }
  return getNamedType(type) as GraphQLObjectType;
};

const findSelect = (field: FieldNode, ownType: GraphQLObjectType) => {
  const node = field.selectionSet?.selections
    .filter((x) => x.kind === Kind.FIELD && x.name.value === "edges")
    .flatMap((x) => (x as FieldNode).selectionSet?.selections ?? [])
    .find((x) => x.kind === Kind.FIELD && x.name.value === "node");

  const self = node && node.kind === Kind.FIELD ? node : field;
  const select: Record<string, any> = {};

  for (const x of self?.selectionSet?.selections ?? []) {
    if (x.kind === Kind.FIELD) {
      const name = x.name.value;
      const prop = ownType.getFields()[name];
      if (isConnection(prop.type)) {
        continue;
      }
      if (isObjectType(prop.type)) {
        select[name] = findSelect(x, findOutputType(prop.type));
      } else {
        select[name] = true;
      }
    }
  }

  return select;
};

const toRelayEdge = async (node: any) => {
  const cursor = node._cursor;
  for (const name of Object.getOwnPropertyNames(node)) {
    let descriptor = Object.getOwnPropertyDescriptor(node, name);
    if (descriptor?.get && descriptor?.set) {
      // load lazy field
      await node[name];
    }
  }

  return {
    node,
    cursor,
  };
};

const toPageInfo = async (res: any[]) => {
  if (res.length === 0) return;
  const first = res[0];
  const last = res[res.length - 1];
  const totalCount = first._count;
  const startCursor = first._cursor;
  const endCursor = last._cursor;
  const hasPreviousPage = first._hasPrev;
  const hasNextPage = last._hasNext;

  return {
    startCursor,
    endCursor,
    hasPreviousPage,
    hasNextPage,
    totalCount,
  };
};

const toEdges = async (res: any[]) => {
  const edges: any[] = [];
  for (const item of res) {
    const edge = await toRelayEdge(item);
    edges.push(edge);
  }
  return edges;
};

export const connectionResolver: GraphQLFieldResolver<
  ResolverSource,
  ResolverContext,
  ResolverArgs
> = async (source, args, context, info) => {
  const { client } = context;
  const { fieldName, fieldNodes } = info;

  const ownType = findOutputType(info.returnType as any);
  const field = fieldNodes[0];
  const select = findSelect(field, ownType);

  return await client.$transaction(async (client) => {
    const entity = source ? toCamelCase(info.parentType.name) : fieldName;
    const repo = Reflect.get(client, entity);

    const where = args.where;
    const orderBy = args.order;

    const { first, after, last, before } = args;

    const take = first ? first : last ? -last : undefined;
    const cursor = after ?? before;

    if (source) {
      const rec = await repo.findOne({
        where: {
          id: { eq: source.id },
        },
        select: {
          [fieldName]: {
            select,
            where,
            orderBy,
            take,
            cursor,
          },
        },
      });
      const res = rec?.[fieldName] ?? [];

      const edges = await toEdges(res);
      const pageInfo = await toPageInfo(res);

      return {
        edges,
        pageInfo,
      };
    }

    const res = await repo.find({
      select,
      where,
      orderBy,
      take,
      cursor,
    });

    const edges = await toEdges(res);
    const pageInfo = await toPageInfo(res);

    return {
      edges,
      pageInfo,
    };
  });
};

export type CreateArgs = {
  data: CreateOptions<any>;
};

export const createResolver: GraphQLFieldResolver<
  ResolverSource,
  ResolverContext,
  CreateArgs
> = async (source, args, context, info) => {
  const { client } = context;
  const { fieldName, fieldNodes } = info;
  const { data } = args;
  const ownType = findOutputType(info.returnType as any);
  const field = fieldNodes[0];
  const select = findSelect(field, ownType);

  return await client.$transaction(async (c) => {
    const entity = toCamelCase(fieldName.substring("create".length));
    const repo = Reflect.get(c, entity);

    const { id } = await repo.create({ data });
    const res = await repo.find({
      select,
      where: { id: { eq: id } },
    });

    const edges = await toEdges(res);
    const pageInfo = await toPageInfo(res);
    return {
      edges,
      pageInfo,
    };
  });
};

export const updateResolver: GraphQLFieldResolver<
  ResolverSource,
  ResolverContext,
  CreateArgs
> = async (source, args, context, info) => {
  const { client } = context;
  const { fieldName, fieldNodes } = info;
  const { data } = args;
  const ownType = findOutputType(info.returnType as any);
  const field = fieldNodes[0];
  const select = findSelect(field, ownType);

  return await client.$transaction(async (c) => {
    const entity = toCamelCase(fieldName.substring("update".length));
    const repo = Reflect.get(c, entity);

    const { id } = await repo.update({ data });
    const res = await repo.find({
      select,
      where: { id: { eq: id } },
    });

    const edges = await toEdges(res);
    const pageInfo = await toPageInfo(res);
    return {
      edges,
      pageInfo,
    };
  });
};

export const deleteResolver: GraphQLFieldResolver<
  ResolverSource,
  ResolverContext,
  CreateArgs
> = async (source, args, context, info) => {
  const { client } = context;
  const { fieldName } = info;
  const { data } = args;

  return await client.$transaction(async (c) => {
    const entity = toCamelCase(fieldName.substring("delete".length));
    const repo = Reflect.get(c, entity);
    const res = await repo.delete(data);
    return res;
  });
};
