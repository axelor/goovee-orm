import { graphql } from "graphql";
import { describe, expect, it } from "vitest";
import { getTestClient } from "./client.utils";
import { createSchema } from "./db/client";
import { createData } from "./fixture";

describe("GraphQL tests", async () => {
  const client = await getTestClient();
  const schema = createSchema();
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

  it("should create", async () => {
    const mutation = /* GraphQL */ `
      mutation {
        createContact(
          data: {
            firstName: "Some"
            lastName: "NAME"
            title: { create: { code: "mr", name: "Mr." } }
            addresses: { create: [{ contact: {}, street: "My HOME" }] }
          }
        ) {
          edges {
            node {
              id
              firstName
              lastName
              title {
                id
                code
                name
              }
              addresses {
                edges {
                  node {
                    id
                    street
                  }
                }
              }
            }
          }
        }
      }
    `;

    const res: any = await graphql({
      schema: schema,
      source: mutation,
      contextValue: {
        client,
      },
    });

    expect(res).toMatchObject({
      data: {
        createContact: {
          edges: [
            {
              node: {
                id: "1",
                firstName: "Some",
                lastName: "NAME",
                title: {
                  id: "1",
                  code: "mr",
                  name: "Mr.",
                },
                addresses: {
                  edges: [
                    {
                      node: {
                        id: "1",
                        street: "My HOME",
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    });
  });

  it("should update", async () => {
    await client.title.create({
      data: {
        code: "mrs",
        name: "Mrs.",
      },
    });
    const contact = await client.contact.create({
      data: {
        firstName: "Some",
        lastName: "Name",
        title: {
          create: {
            code: "mr",
            name: "Mr.",
          },
        },
        addresses: {
          create: [
            {
              contact: {},
              street: "My Home",
            },
          ],
        },
      },
      select: {
        firstName: true,
        lastName: true,
        title: {
          name: true,
        },
        addresses: {
          select: {
            street: true,
          },
        },
      },
    });

    const mutation = /* GraphQL */ `
      mutation {
        updateContact(
          data: {
            id: ${contact.id}
            version: ${contact.version}
            lastName: "NAME"
            title: { select: { code: { eq: "mrs" } } }
            addresses: {
              create: { contact: {}, street: "My Office" }
              remove: [ ${contact.addresses![0].id}]
            }
          }
        ) {
          edges {
            node {
              id
              firstName
              lastName
              title {
                code
              }
              addresses {
                edges {
                  node {
                    street
                  }
                }
              }
            }
          }
        }
      }
    `;

    const res: any = await graphql({
      schema: schema,
      source: mutation,
      contextValue: {
        client,
      },
    });

    const json = JSON.stringify(res, null, 2);

    expect(json).toContain('"lastName": "NAME"');
    expect(json).toContain('"code": "mrs"');
    expect(json).toContain('"street": "My Office"');
    expect(json).not.toContain('"street": "My Home"');
  });

  it("should delete", async () => {
    await createData(client);
    const mutation = /* GraphQL */ `
      mutation {
        deleteAddress(data: { id: 1, version: 1 })
      }
    `;
    const res: any = await graphql({
      schema: schema,
      source: mutation,
      contextValue: {
        client,
      },
    });

    expect(res).toMatchObject({ data: { deleteAddress: 1 } });
  });

  it("should handle json fields", async () => {
    const mutation = /* GraphQL */ `
      mutation CreateContact($data: ContactCreateInput!) {
        createContact(data: $data) {
          edges {
            node {
              id
              firstName
              lastName
              attrs
            }
          }
        }
      }
    `;

    const now = new Date();
    const res = await graphql({
      schema: schema,
      source: mutation,
      variableValues: {
        data: {
          firstName: "Some",
          lastName: "NAME",
          attrs: {
            some: "name",
            int: 1,
            array: ["some", 1, 232.2, now],
            nested: {
              a: 1,
              b: true,
              c: "some",
              d: now,
            },
          },
        },
      },
      contextValue: {
        client,
      },
    });

    expect(res).toMatchObject({
      data: {
        createContact: {
          edges: [
            {
              node: {
                id: "1",
                firstName: "Some",
                lastName: "NAME",
                attrs: {
                  int: 1,
                  some: "name",
                  array: ["some", 1, 232.2, now.toISOString()],
                  nested: {
                    a: 1,
                    b: true,
                    c: "some",
                    d: now.toISOString(),
                  },
                },
              },
            },
          ],
        },
      },
    });

    const next = await graphql({
      schema: schema,
      source: mutation,
      variableValues: {
        data: {
          firstName: "Another",
          lastName: "NAME",
          attrs: {
            some: "another name",
            int: 1,
            array: ["another", 2, 432.2, now],
            nested: {
              a: 1,
              b: true,
              c: "another",
              d: now,
            },
          },
        },
      },
      contextValue: {
        client,
      },
    });

    const query = /* GraphQL */ `
      {
        contact(where: { attrs: { path: "some", eq: "name" } }) {
          edges {
            node {
              id
              firstName
              lastName
              attrs
            }
          }
        }
      }
    `;

    const found = await graphql({
      schema,
      source: query,
      contextValue: {
        client,
      },
    });

    const foundContact: any = found?.data?.contact;

    expect(foundContact).toBeDefined();
    expect(foundContact.edges).toHaveLength(1);
    expect(foundContact.edges[0].node.attrs.some).toBe("name");
  });

  it("should handle date fields", async () => {
    const mutation = /* GraphQL */ `
      mutation CreateContact($data: ContactCreateInput!) {
        createContact(data: $data) {
          edges {
            node {
              firstName
              lastName
              dateOfBirth
            }
          }
        }
      }
    `;

    const now = new Date();
    const res: any = await graphql({
      schema: schema,
      source: mutation,
      variableValues: {
        data: {
          firstName: "Some",
          lastName: "NAME",
          dateOfBirth: now,
        },
      },
      contextValue: {
        client,
      },
    });

    expect(res).toMatchObject({
      data: {
        createContact: {
          edges: [
            {
              node: {
                firstName: "Some",
                lastName: "NAME",
                dateOfBirth: now.toISOString().split("T")[0],
              },
            },
          ],
        },
      },
    });
  });

  it("should handle binary fields", async () => {
    const mutation = /* GraphQL */ `
      mutation CreateContact($data: ContactCreateInput!) {
        createContact(data: $data) {
          edges {
            node {
              firstName
              lastName
              image
            }
          }
        }
      }
    `;

    const buffer = Buffer.from("Hello World!!!", "utf-8");
    const res: any = await graphql({
      schema: schema,
      source: mutation,
      variableValues: {
        data: {
          firstName: "Some",
          lastName: "NAME",
          image: buffer,
        },
      },
      contextValue: {
        client,
      },
    });

    expect(res).toBeDefined();
    expect(res.data!.createContact.edges).toHaveLength(1);
    expect(res.data!.createContact.edges[0].node.image).toBeInstanceOf(Buffer);
    expect(res.data!.createContact.edges[0].node.image.toString("utf-8")).toBe(
      "Hello World!!!",
    );
  });
});
