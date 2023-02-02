import { graphql } from "graphql";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildGraphQLSchema } from "../graphql/graphql-schema";
import { readSchema } from "../schema";
import { getTestClient } from "./client.utils";
import { createData } from "./fixture";

describe("GraphQL tests", async () => {
  const entities = readSchema(path.join(__dirname, "schema"));
  const client = await getTestClient();
  const schema = buildGraphQLSchema(entities);
  it("should query", async () => {
    await createData(client);
    const query = /* GraphQL */ `
      {
        contact(first: 2) {
          edges {
            node {
              id
              version
              fullName
              title {
                code
                name
              }
              addresses(first: 1) {
                edges {
                  node {
                    street
                  }
                }
                pageInfo {
                  startCursor
                  endCursor
                  hasPreviousPage
                  hasNextPage
                  totalCount
                }
              }
            }
          }
          pageInfo {
            startCursor
            endCursor
            hasPreviousPage
            hasNextPage
            totalCount
          }
        }
      }
    `;

    const res: any = await graphql({
      schema: schema,
      source: query,
      contextValue: {
        client,
      },
    });

    expect(res).toBeDefined();
    expect(res.data).toBeDefined();
    expect(res.data?.contact).toBeDefined();

    const { pageInfo, edges } = res.data?.contact;

    expect(pageInfo).toBeDefined();
    expect(pageInfo.startCursor).toBeDefined();
    expect(pageInfo.endCursor).toBeDefined();
    expect(pageInfo.hasPreviousPage).toBeFalsy();
    expect(pageInfo.hasNextPage).toBeTruthy();
    expect(pageInfo.totalCount).toBeGreaterThan(0);

    expect(edges).toHaveLength(2);

    edges.forEach(({ node }: any) => {
      expect(node.title).toBeDefined();
      expect(node.addresses).toBeDefined();
      expect(node.addresses.edges).toBeDefined();
      expect(node.addresses.pageInfo).toBeDefined();
      expect(node.addresses.edges.length).toBeGreaterThan(0);
    });
  });
});
