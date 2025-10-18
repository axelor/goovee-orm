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

  it("should handle transaction commit", async () => {
    const client = await getTestClient();

    const result = await client.$transaction(async (tc) => {
      const title = await tc.title.create({
        data: {
          code: "dr",
          name: "Dr.",
        },
      });

      const contact = await tc.contact.create({
        data: {
          firstName: "John",
          lastName: "Doe",
          title: {
            select: {
              id: title.id,
            },
          },
        },
      });

      return { title, contact };
    });

    expect(result).toBeDefined();
    expect(result.title.code).toBe("dr");
    expect(result.contact.firstName).toBe("John");

    // Verify data was committed
    const foundContact = await client.contact.findOne({
      where: { id: result.contact.id },
      select: {
        firstName: true,
        title: {
          code: true,
        },
      },
    });

    expect(foundContact).toBeDefined();
    expect(foundContact!.firstName).toBe("John");
    expect(foundContact!.title?.code).toBe("dr");
  });

  it("should handle transaction rollback on error", async () => {
    const client = await getTestClient();
    const initialCount = await client.title.count();

    await expect(
      client.$transaction(async (tc) => {
        await tc.title.create({
          data: {
            code: "mr",
            name: "Mr.",
          },
        });

        await tc.title.create({
          data: {
            code: "mrs",
            name: "Mrs.",
          },
        });

        // Force an error
        throw new Error("Transaction failed");
      }),
    ).rejects.toThrow("Transaction failed");

    // Verify no data was committed
    const finalCount = await client.title.count();
    expect(finalCount).toBe(initialCount);
  });

  it("should maintain optimistic locking in transaction", async () => {
    const client = await getTestClient();
    const contact = await client.contact.create({
      data: {
        firstName: "Lock",
        lastName: "Test",
      },
    });

    await expect(
      client.$transaction(async (tc) => {
        await tc.contact.update({
          data: {
            id: contact.id,
            version: 999, // Wrong version
            firstName: "Updated",
          },
        });
      }),
    ).rejects.toThrow(/optimistic lock.*failed/i);
  });
});
