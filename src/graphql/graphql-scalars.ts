import { GraphQLScalarType, Kind } from "graphql";

const isJsonString = (value: string) => {
  const s = value.trim();
  return s.startsWith('"') && s.endsWith('"');
};

export const GraphQLJSON = new GraphQLScalarType({
  name: "JSON",
  description: "The `JSON` scalar type",
  serialize(outputValue) {
    return outputValue;
  },
  parseValue(inputValue) {
    return typeof inputValue === "string" && isJsonString(inputValue)
      ? JSON.parse(inputValue)
      : inputValue;
  },
  parseLiteral(node, variables) {
    switch (node.kind) {
      case Kind.STRING:
      case Kind.BOOLEAN:
        return node.value;
      case Kind.INT:
      case Kind.FLOAT:
        return parseFloat(node.value);
      case Kind.OBJECT:
        return node.fields.reduce((prev: any, field) => {
          prev[field.name.value] = this.parseLiteral!(field.value, variables);
          return prev;
        }, {});
      case Kind.LIST:
        return node.values.map((n) => this.parseLiteral!(n, variables));
      case Kind.NULL:
        return null;
      case Kind.VARIABLE:
        return variables?.[node.name.value];
    }
  },
});

export const GraphQLDate = new GraphQLScalarType({
  name: "Date",
  description: "The `Date` scalar type",
  serialize(outputValue) {
    if (outputValue instanceof Date) {
      const yyyy = outputValue.getFullYear();
      const mm = String(outputValue.getMonth() + 1).padStart(2, "0");
      const dd = String(outputValue.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
    return outputValue;
  },
  parseValue(inputValue) {
    return inputValue;
  },
});

export const GraphQLTime = new GraphQLScalarType({
  name: "Time",
  description: "The `Time` scalar type",
  serialize(outputValue) {
    return outputValue;
  },
  parseValue(inputValue) {
    return inputValue;
  },
});

export const GraphQLDateTime = new GraphQLScalarType({
  name: "DateTime",
  description: "The `DateTime` scalar type",
  serialize(outputValue) {
    return outputValue;
  },
  parseValue(inputValue) {
    return inputValue;
  },
});

export const GraphQLBuffer = new GraphQLScalarType({
  name: "Buffer",
  description: "The `Buffer` scalar type",
  serialize(outputValue) {
    return outputValue;
  },
  parseValue(inputValue) {
    if (inputValue instanceof Promise) {
      return inputValue;
    }
    if (inputValue) {
      return Promise.resolve(inputValue);
    }
  },
});

export const GraphQLDecimal = new GraphQLScalarType({
  name: "Decimal",
  description: "The `Decimal` scalar type",
  async serialize(outputValue) {
    return outputValue;
  },
  async parseValue(inputValue) {
    return inputValue;
  },
});

export const GraphQLBigInt = new GraphQLScalarType({
  name: "BigInt",
  description: "The `BigInt` scalar type",
  serialize(outputValue) {
    return outputValue;
  },
  parseValue(inputValue) {
    return inputValue;
  },
  parseLiteral(valueNode) {
    if (valueNode.kind === Kind.STRING || valueNode.kind === Kind.INT) {
      return valueNode.value;
    }
  },
});
