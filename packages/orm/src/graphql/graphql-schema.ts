import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFieldConfig,
  GraphQLID,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from "graphql";
import { toCamelCase } from "../schema";

import { EntityOptions, EnumItem } from "../schema/types";
import {
  connectionResolver,
  createResolver,
  deleteResolver,
  updateResolver,
} from "./graphql-resolvers";
import {
  GraphQLBigInt,
  GraphQLBuffer,
  GraphQLDate,
  GraphQLDateTime,
  GraphQLDecimal,
  GraphQLJSON,
  GraphQLTime,
} from "./graphql-scalars";

const createStringFilterFields = (type: GraphQLInputType) => {
  return {
    eq: { type },
    ne: { type },
    like: { type },
    notLike: { type },
    in: { type: new GraphQLList(new GraphQLNonNull(type)) },
    notIn: { type: new GraphQLList(new GraphQLNonNull(type)) },
  };
};

const createNumberFilterFields = (type: GraphQLInputType) => {
  return {
    eq: { type },
    ne: { type },
    gt: { type },
    ge: { type },
    lt: { type },
    le: { type },
    in: { type: new GraphQLList(new GraphQLNonNull(type)) },
    notIn: { type: new GraphQLList(new GraphQLNonNull(type)) },
    between: { type: new GraphQLList(new GraphQLNonNull(type)) },
    notBetween: { type: new GraphQLList(new GraphQLNonNull(type)) },
  };
};

const IdFilter = new GraphQLInputObjectType({
  name: "IdFilter",
  fields: {
    eq: { type: GraphQLID },
    ne: { type: GraphQLID },
    in: { type: new GraphQLList(new GraphQLNonNull(GraphQLID)) },
    notIn: { type: new GraphQLList(new GraphQLNonNull(GraphQLID)) },
  },
});

const BooleanFilter = new GraphQLInputObjectType({
  name: "BooleanFilters",
  fields: {
    eq: { type: GraphQLBoolean },
  },
});

const StringFilter = new GraphQLInputObjectType({
  name: "StringFilter",
  fields: createStringFilterFields(GraphQLString),
});

const NumberFilter = new GraphQLInputObjectType({
  name: "NumberFilter",
  fields: createNumberFilterFields(GraphQLString),
});

const JsonTypeName = new GraphQLEnumType({
  name: "JsonTypeName",
  values: {
    String: { value: "text" },
    Int: { value: "integer" },
    Date: { value: "timestamp" },
    Boolean: { value: "boolean" },
    Decimal: { value: "decimal" },
  },
});

const JsonFilter = new GraphQLInputObjectType({
  name: "JsonFilter",
  fields() {
    const fields = {
      path: { type: new GraphQLNonNull(GraphQLString) },
      type: { type: JsonTypeName },
    };
    const numOps = createNumberFilterFields(GraphQLJSON);
    const strOps = createStringFilterFields(GraphQLJSON);
    return {
      ...fields,
      ...numOps,
      ...strOps,
    };
  },
});

const OrderBy = new GraphQLEnumType({
  name: "OrderBy",
  values: {
    ASC: { value: "ASC" },
    DESC: { value: "DESC" },
  },
});

const JsonOrderBy = new GraphQLInputObjectType({
  name: "JsonOrderByValue",
  fields: {
    path: { type: new GraphQLNonNull(GraphQLString) },
    type: { type: JsonTypeName },
    order: { type: OrderBy },
  },
});

const PageInfo = new GraphQLObjectType({
  name: "PageInfo",
  fields: {
    hasNextPage: { type: GraphQLBoolean },
    hasPreviousPage: { type: GraphQLBoolean },
    startCursor: { type: GraphQLID },
    endCursor: { type: GraphQLID },
    totalCount: { type: GraphQLBigInt },
  },
});

const IdentityInput = new GraphQLInputObjectType({
  name: "IdentityInput",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    version: { type: new GraphQLNonNull(GraphQLInt) },
  },
});

const TypeMap: Record<string, GraphQLInputType> = {
  String: GraphQLString,
  Int: GraphQLInt,
  Boolean: GraphQLBoolean,
  BigInt: GraphQLBigInt,
  Decimal: GraphQLDecimal,
  Date: GraphQLDate,
  Time: GraphQLTime,
  DateTime: GraphQLDateTime,
  Binary: GraphQLBuffer,
  JSON: GraphQLJSON,
  Text: GraphQLString,
};

const FilterMap: Record<string, GraphQLInputType> = {
  String: StringFilter,
  Int: NumberFilter,
  Boolean: BooleanFilter,
  BigInt: NumberFilter,
  Decimal: NumberFilter,
  Date: NumberFilter,
  Time: NumberFilter,
  DateTime: NumberFilter,
  Text: StringFilter,
  JSON: JsonFilter,
};

export const buildGraphQLSchema = (entities: EntityOptions[]) => {
  const enums: Record<string, GraphQLEnumType> = {};
  const nodes: Record<string, GraphQLObjectType> = {};
  const edges: Record<string, GraphQLObjectType> = {};
  const connections: Record<string, GraphQLObjectType> = {};
  const filters: Record<string, GraphQLInputObjectType> = {};
  const orders: Record<string, GraphQLInputObjectType> = {};
  const createInputs: Record<string, GraphQLInputObjectType> = {};
  const updateInputs: Record<string, GraphQLInputObjectType> = {};
  const nestedCreateInputs: Record<string, GraphQLInputObjectType> = {};
  const nestedUpdateInputs: Record<string, GraphQLInputObjectType> = {};

  const nameNode = (name: string) => name;
  const nameEdge = (name: string) => `${name}Edge`;
  const nameConnection = (name: string) => `${name}Connection`;
  const nameFilter = (name: string) => `${name}Filter`;
  const nameOrder = (name: string) => `${name}Order`;
  const nameCreateInput = (name: string) => `${name}CreateInput`;
  const nameUpdateInput = (name: string) => `${name}UpdateInput`;
  const nameNestedCreate = (name: string) => `${name}NestedCreateInput`;
  const nameNestedUpdate = (name: string) => `${name}NestedUpdateInput`;

  const findEnum = (name: string) => enums[name];

  const findNode = (name: string) => nodes[name] ?? nodes[nameNode(name)];

  const findConnection = (name: string) =>
    connections[name] ?? connections[nameConnection(name)];

  const findFilter = (name: string) =>
    filters[name] ?? filters[nameFilter(name)];

  const findOrder = (name: string) => orders[name] ?? orders[nameOrder(name)];

  const findCreateInput = (name: string) =>
    createInputs[name] ?? createInputs[nameCreateInput(name)];

  const findUpdateInput = (name: string) =>
    updateInputs[name] ?? updateInputs[nameUpdateInput(name)];

  const findNestedCreateInput = (name: string) =>
    nestedCreateInputs[name] ?? nestedCreateInputs[nameNestedCreate(name)];

  const findNestedUpdateInput = (name: string) =>
    nestedUpdateInputs[name] ?? nestedUpdateInputs[nameNestedUpdate(name)];

  const createConnectionArgs = (typeName: string) => {
    return {
      where: { type: findFilter(typeName) },
      order: { type: findOrder(typeName) },
      first: { type: GraphQLInt },
      after: { type: GraphQLString },
      last: { type: GraphQLInt },
      before: { type: GraphQLString },
    };
  };

  const createNode = (entity: EntityOptions) => {
    const name = nameNode(entity.name);
    const node = new GraphQLObjectType({
      name,
      fields() {
        const fields = {
          id: { type: GraphQLID },
          version: { type: GraphQLInt },
        };

        for (const item of (entity.fields ?? []) as any[]) {
          let { type, target } = item;

          let isReference = type.endsWith("ToOne");
          let isCollection = type.endsWith("ToMany");
          let isEnum = type === "Enum";

          if (type in TypeMap) type = TypeMap[type];
          if (isEnum) type = findEnum(item.enumType);
          if (isReference) type = findNode(target);
          if (isCollection) type = findConnection(target);

          let field: GraphQLFieldConfig<any, any> = { type };

          if (isCollection) {
            field.args = createConnectionArgs(target);
            field.resolve = connectionResolver;
          }

          Object.assign(fields, {
            [item.name]: field,
          });
        }

        Object.assign(fields, {
          createdOn: { type: GraphQLDateTime },
          updatedOn: { type: GraphQLDateTime },
        });

        return fields;
      },
    });

    return (nodes[name] = node);
  };

  const createEdge = (entity: EntityOptions) => {
    const name = nameEdge(entity.name);
    const edge = new GraphQLObjectType({
      name,
      fields() {
        const node = nodes[entity.name];
        return {
          node: { type: new GraphQLNonNull(node) },
          cursor: { type: new GraphQLNonNull(GraphQLString) },
        };
      },
    });
    return (edges[name] = edge);
  };

  const createConnection = (entity: EntityOptions) => {
    const name = nameConnection(entity.name);
    const connection = new GraphQLObjectType({
      name,
      fields() {
        const edge = edges[nameEdge(entity.name)];
        return {
          edges: { type: new GraphQLList(edge) },
          pageInfo: { type: PageInfo },
        };
      },
    });
    return (connections[name] = connection);
  };

  const createEnumFilter = (enumName: string, enumList: EnumItem[]) => {
    const name = nameFilter(enumName);
    const filter = new GraphQLInputObjectType({
      name,
      fields() {
        const isNumber = enumList.some((x) => typeof x.value === "number");
        const enumType = findEnum(enumName);
        const fields = isNumber
          ? createNumberFilterFields(enumType)
          : createStringFilterFields(enumType);
        return fields as any;
      },
    });

    return (filters[name] = filter);
  };

  const createFilter = (entity: EntityOptions) => {
    const name = nameFilter(entity.name);
    const filter = new GraphQLInputObjectType({
      name,
      fields() {
        const { fields: items = [] } = entity;
        const fields: any = {
          id: { type: IdFilter },
          version: { type: NumberFilter },
        };

        for (const item of items as any[]) {
          if (item.type === "Binary") continue;
          let { type, target } = item;
          if (target) {
            type = findFilter(target);
          } else if (type === "Enum") {
            type = findFilter(item.enumType);
          } else {
            type = FilterMap[type];
          }

          fields[item.name] = { type };
        }

        Object.assign(fields, {
          createdOn: { type: NumberFilter },
          updatedOn: { type: NumberFilter },
        });

        Object.assign(fields, {
          OR: { type: new GraphQLList(filter) },
          AND: { type: new GraphQLList(filter) },
          NOT: { type: new GraphQLList(filter) },
        });

        return fields;
      },
    });

    return (filters[name] = filter);
  };

  const createOrder = (entity: EntityOptions) => {
    const name = nameOrder(entity.name);
    const input = new GraphQLInputObjectType({
      name,
      fields() {
        const { fields: items = [] } = entity;
        const fields = {
          id: { type: OrderBy },
          version: { type: OrderBy },
        };

        for (const item of items as any[]) {
          if (item.type === "Binary") continue;
          const type = item.target
            ? findOrder(item.target)
            : item.type === "JSON"
            ? new GraphQLList(JsonOrderBy)
            : OrderBy;
          Object.assign(fields, {
            [item.name]: { type },
          });
        }

        Object.assign(fields, {
          createdOn: { type: OrderBy },
          updatedOn: { type: OrderBy },
        });

        return fields;
      },
    });
    return (orders[name] = input);
  };

  const nestedCreateInput = (entity: EntityOptions) => {
    const name = nameNestedCreate(entity.name);
    const input = new GraphQLInputObjectType({
      name,
      fields: {
        create: { type: new GraphQLList(findCreateInput(entity.name)) },
        select: { type: new GraphQLList(findFilter(entity.name)) },
      },
    });
    return (nestedCreateInputs[name] = input);
  };

  const nestedUpdateInput = (entity: EntityOptions) => {
    const name = nameNestedUpdate(entity.name);
    const input = new GraphQLInputObjectType({
      name,
      fields: {
        create: { type: new GraphQLList(findCreateInput(entity.name)) },
        update: { type: new GraphQLList(findUpdateInput(entity.name)) },
        select: { type: new GraphQLList(findFilter(entity.name)) },
        remove: { type: new GraphQLList(GraphQLID) },
      },
    });
    return (nestedUpdateInputs[name] = input);
  };

  const createCreateInput = (entity: EntityOptions) => {
    const name = nameCreateInput(entity.name);
    const input = new GraphQLInputObjectType({
      name,
      fields() {
        const { fields: items = [] } = entity;
        const fields = {};
        for (const item of items as any[]) {
          let { type, target, required } = item;
          if (target) {
            type = findNestedCreateInput(target);
          } else if (type === "Enum") {
            type = findEnum(item.enumType);
          } else {
            type = TypeMap[type];
          }

          if (required) {
            type = new GraphQLNonNull(type);
          }

          Object.assign(fields, {
            [item.name]: { type },
          });
        }
        return fields;
      },
    });
    return (createInputs[name] = input);
  };

  const createUpdateInput = (entity: EntityOptions) => {
    const name = nameUpdateInput(entity.name);
    const input = new GraphQLInputObjectType({
      name,
      fields() {
        const { fields: items = [] } = entity;
        const fields = {
          id: { type: GraphQLID },
          version: { type: GraphQLInt },
        };
        for (const item of items as any[]) {
          let { type, target } = item;
          if (target) {
            type = findNestedUpdateInput(target);
          } else if (type === "Enum") {
            type = findEnum(item.enumType);
          } else {
            type = TypeMap[type];
          }

          Object.assign(fields, {
            [item.name]: { type },
          });
        }
        return fields;
      },
    });
    return (updateInputs[name] = input);
  };

  // first generate enum types
  entities
    .flatMap((x) => x.fields ?? [])
    .forEach((x) => {
      if (x.type === "Enum") {
        const name = x.enumType;
        const items = x.enumList;
        const values = items.reduce(
          (prev, x) => ({
            ...prev,
            [x.name]: { value: x.value },
          }),
          {}
        );
        const type = new GraphQLEnumType({
          name,
          values,
        });
        Object.assign(enums, {
          [name]: type,
        });

        // also define enum filters
        createEnumFilter(name, items);
      }
    });

  // generate all types
  for (const entity of entities) {
    if (entity.abstract) continue;
    createNode(entity);
    createEdge(entity);
    createConnection(entity);
    createFilter(entity);
    createOrder(entity);
    createCreateInput(entity);
    createUpdateInput(entity);
    nestedCreateInput(entity);
    nestedUpdateInput(entity);
  }

  const query = new GraphQLObjectType({
    name: "Query",
    fields() {
      return Object.keys(nodes).reduce(
        (prev, name) => ({
          ...prev,
          [toCamelCase(name)]: {
            type: findConnection(name),
            args: createConnectionArgs(name),
            resolve: connectionResolver,
          },
        }),
        {}
      );
    },
  });

  const mutation = new GraphQLObjectType({
    name: "Mutation",
    fields() {
      return Object.keys(nodes).reduce((prev, name) => {
        return {
          ...prev,
          [`create${name}`]: {
            type: findConnection(name),
            args: { data: { type: findCreateInput(name) } },
            resolve: createResolver,
          },
          [`update${name}`]: {
            type: findConnection(name),
            args: { data: { type: findUpdateInput(name) } },
            resolve: updateResolver,
          },
          [`delete${name}`]: {
            type: GraphQLInt,
            args: { data: { type: IdentityInput } },
            resolve: deleteResolver,
          },
        };
      }, {});
    },
  });

  return new GraphQLSchema({
    query,
    mutation,
  });
};
