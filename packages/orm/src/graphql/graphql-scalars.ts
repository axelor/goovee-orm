import { GraphQLScalarType } from "graphql";

export const GraphQLJSON = new GraphQLScalarType({
  name: "JSON",
});

export const GraphQLDate = new GraphQLScalarType({
  name: "Date",
});

export const GraphQLTime = new GraphQLScalarType({
  name: "Time",
});

export const GraphQLDateTime = new GraphQLScalarType({
  name: "DateTime",
});

export const GraphQLBuffer = new GraphQLScalarType({
  name: "Buffer",
});

export const GraphQLDecimal = new GraphQLScalarType({
  name: "Decimal",
});

export const GraphQLBigInt = new GraphQLScalarType({
  name: "BigInt",
});
