import { afterEach, describe, expect, it } from "vitest";
import { getTestClient, resetTestClient } from "./client.utils";

describe("middleware tests", async () => {
  afterEach(async () => {
    await resetTestClient();
  });

  it("should intercept `find` method", async () => {
    const client = await getTestClient();

    let called = 0;
    let clients: any[] = [];

    client.$use(async (params, next) => {
      const { client, method } = params;
      if (method === "find") {
        called++;
        clients.push(client);
      }
    });

    const res = await client.contact.find({
      where: {
        title: {
          name: { eq: "mr" },
        },
      },
    });

    await client.$transaction(async (c) => {
      await c.contact.find({
        where: {
          title: {
            name: { eq: "mr" },
          },
        },
      });
    });

    expect(res).toBeUndefined(); // as we have not called `next` inside middleware

    expect(called).toBe(2);
    expect(clients).toHaveLength(2);
    expect(clients[0]).not.equal(clients[1]);
  });

  it("should intercept `create` method", async () => {
    const client = await getTestClient();

    let called = 0;

    client.$use(async (params, next) => {
      const { method, args } = params;

      if (method === "create") {
        called++;

        const opts = args[0];

        // modify args
        if (opts.data?.lastName === "Name") {
          opts.data.lastName = "NAME";
        }
      }

      return await next();
    });

    const res = await client.contact.create({
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
        fullName: true,
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

    expect(called).toBe(3);
    expect(res.lastName).toBe("NAME"); // modified by middleware
  });

  it("should intercept `delete` method", async () => {
    const client = await getTestClient();
    let called = 0;

    client.$use(async (params, next) => {
      const { method } = params;
      if (method === "delete") called++;
    });

    await client.contact.delete({ id: 1, version: 0 });
    expect(called).toBe(1);
  });

  it("should intercept `update` method", async () => {
    const client = await getTestClient();
    let called = 0;

    client.$use(async (params, next) => {
      const { method } = params;
      if (method === "update") called++;
    });

    await client.contact.update({ data: { id: "1", version: 0 } });
    expect(called).toBe(1);
  });

  it("should intercept `count` method", async () => {
    const client = await getTestClient();
    let called = 0;

    client.$use(async (params, next) => {
      const { method } = params;
      if (method === "count") called++;
    });

    await client.contact.count();
    expect(called).toBe(1);
  });

  it("should intercept `updateAll` method", async () => {
    const client = await getTestClient();
    let called = 0;

    client.$use(async (params, next) => {
      const { method } = params;
      if (method === "updateAll") called++;
    });

    await client.contact.updateAll({
      set: {
        lastName: "NAME",
      },
    });
    expect(called).toBe(1);
  });

  it("should intercept `deleteAll` method", async () => {
    const client = await getTestClient();
    let called = 0;

    client.$use(async (params, next) => {
      const { method } = params;
      if (method === "deleteAll") called++;
    });

    await client.contact.deleteAll();
    expect(called).toBe(1);
  });
});
