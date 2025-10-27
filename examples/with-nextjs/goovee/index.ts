import { Middleware } from "@goovee/orm";
import { GraphQLSchema } from "graphql";

import { GooveeClient, createClient, createSchema } from "./db/client";
import { PostStatus } from "./db/models";

let client: GooveeClient;
let schema: GraphQLSchema;

// middleware example
const onCreate: Middleware = async (params, next) => {
  const { source, method, args } = params;
  const opts = args[0];

  if (source.name === "Post" && method === "create") {
    // do something with opts.data
    opts.data.status = PostStatus.Draft;
  }

  return await next();
};

export async function getClient() {
  if (client === undefined) {
    client = createClient();
    await client.$connect();
    await client.$sync();

    // add middlewares
    client.$use(onCreate);
  }
  return client;
}

export function getSchema() {
  if (schema === undefined) {
    schema = createSchema();
  }
  return schema;
}
