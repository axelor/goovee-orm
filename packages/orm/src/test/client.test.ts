import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestClient } from "./client.utils";
import { Contact } from "./entity";

describe("client tests", async () => {
  const client = await createTestClient();
  beforeEach(async () => {
    await client.$connect();
    await client.$sync(true);
  });
  afterEach(async () => {
    await client.$disconnect();
  });

  it("should create", async () => {
    await client.title.create({
      data: {
        code: "mr",
        name: "Mr.",
      },
    });

    await client.title.create({
      data: {
        code: "mrs",
        name: "Mrs.",
      },
    });

    await client.country.create({
      data: {
        code: "fr",
        name: "France",
      },
    });

    await client.contact.create({
      data: {
        firstName: "Some",
        lastName: "Name",
        title: {
          select: {
            code: "mr",
          },
        },
      },
    });

    await client.address.create({
      data: {
        street: "My HOME",
        contact: {
          select: {
            firstName: "Some",
            lastName: "Name",
          },
        },
      },
    });

    const res = await client.contact.findOne({
      select: {
        id: true,
        version: true,
        firstName: true,
        lastName: true,
        title: {
          id: true,
          name: true,
        },
        fullName: true,
        addresses: {
          select: {
            id: true,
            street: true,
          },
        },
      },
      where: {
        id: 1,
      },
    });

    const titleCount = await client.title.count();
    expect(titleCount).toBe(2);

    expect(res).toBeInstanceOf(Contact);
    expect(res.id).toBeTruthy();
    expect(res.fullName).toBe("Mr. Some Name");
    expect(res.title).toBeDefined();
    expect(res.addresses).toHaveLength(1);

    const bulkUpdated = await client.contact.updateAll({
      set: {
        lastName: "NAME",
        title: {
          id: null,
        },
      },
    });

    expect(bulkUpdated).toBe(1);

    const afterBulkUpdate = await client.contact.findOne({
      select: {
        lastName: true,
        title: {
          id: true,
        },
      },
      where: { id: res.id },
    });

    expect(afterBulkUpdate).toBeDefined();
    expect(afterBulkUpdate.lastName).toBe("NAME");
    expect(afterBulkUpdate.title).toBeNull();
  });
});
