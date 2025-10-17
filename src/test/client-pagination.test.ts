import { beforeEach, describe, expect, it } from "vitest";
import { QueryOptions } from "../client";
import { getTestClient } from "./client.utils";
import { Contact } from "./db/models";
import { createData } from "./fixture";

describe("client pagination tests", async () => {
  const client = await getTestClient();

  beforeEach(async () => createData(client));

  it("should do offset pagination", async () => {
    const first = await client.contact.find({
      select: { id: true },
      take: 1,
    });

    expect(first).toHaveLength(1);
    expect(first[0].id).toBe("1");

    const first5 = await client.contact.find({
      select: { id: true },
      take: 5,
    });

    expect(first5).toHaveLength(5);
    expect(first5.map((x) => x.id)).toMatchObject(["1", "2", "3", "4", "5"]);

    const after6 = await client.contact.find({
      select: { id: true },
      take: 3,
      skip: 6,
    });

    expect(after6).toHaveLength(3);
    expect(after6.map((x) => x.id)).toMatchObject(["7", "8", "9"]);

    const last = await client.contact.find({
      select: { id: true },
      take: -1,
    });

    expect(last).toHaveLength(1);
    expect(last[0].id).toBe("20");

    const last5 = await client.contact.find({
      select: { id: true },
      take: -5,
    });

    expect(last5).toHaveLength(5);
    expect(last5.map((x) => x.id)).toMatchObject([
      "16",
      "17",
      "18",
      "19",
      "20",
    ]);

    const before15 = await client.contact.find({
      select: { id: true },
      take: -3,
      skip: 6,
    });

    expect(before15).toHaveLength(3);
    expect(before15.map((x) => x.id)).toMatchObject(["12", "13", "14"]);
  });

  it("should do cursor pagination", async () => {
    const first5 = await client.contact.find({
      select: {
        firstName: true,
        title: {
          code: true,
          name: true,
        },
      },
      take: 5,
    });

    expect(first5).toHaveLength(5);

    const fifth = first5[4];

    expect(fifth).not.toHaveProperty("_count", undefined);
    expect(fifth).not.toHaveProperty("_cursor", undefined);

    const after5th = await client.contact.find({
      select: {
        firstName: true,
        title: {
          code: true,
          name: true,
        },
      },
      take: 3,
      cursor: fifth._cursor,
    });

    expect(after5th).toHaveLength(3);
    expect(after5th.map((x) => x.id)).toMatchObject(["6", "7", "8"]);

    const after5thSkip2 = await client.contact.find({
      select: {
        firstName: true,
        title: {
          code: true,
          name: true,
        },
      },
      take: 3,
      skip: 2,
      cursor: fifth._cursor,
    });

    expect(after5thSkip2).toHaveLength(3);
    expect(after5thSkip2.map((x) => x.id)).toMatchObject(["8", "9", "10"]);

    const eighth = after5th[2];

    const before8th = await client.contact.find({
      select: {
        firstName: true,
        title: {
          code: true,
          name: true,
        },
      },
      take: -3,
      cursor: eighth._cursor,
    });

    expect(before8th).toHaveLength(3);
    expect(before8th.map((x) => x.id)).toMatchObject(["5", "6", "7"]);
  });

  it("should do cursor pagination with complex ordering", async () => {
    const opts: QueryOptions<Contact> = {
      select: {
        fullName: true,
        title: {
          code: true,
          name: true,
        },
      },
      orderBy: {
        title: {
          code: "ASC",
        },
        id: "DESC",
      },
    };

    const all = await client.contact.find(opts);
    const first = await client.contact.find({
      ...opts,
      take: 2,
    });

    expect(first).toHaveLength(2);
    expect(first[0]).toMatchObject(all[0]);
    expect(first[1]).toMatchObject(all[1]);

    const next3 = await client.contact.find({
      ...opts,
      take: 3,
      skip: 2,
      cursor: first[1]._cursor,
    });

    expect(next3).toHaveLength(3);
    expect(next3[0]).toMatchObject(all[4]);
    expect(next3[1]).toMatchObject(all[5]);
    expect(next3[2]).toMatchObject(all[6]);

    const prev2 = await client.contact.find({
      ...opts,
      take: -2,
      cursor: next3[0]._cursor,
    });

    expect(prev2).toHaveLength(2);
    expect(prev2[0]).toMatchObject(all[2]);
    expect(prev2[1]).toMatchObject(all[3]);
  });

  it("should support distinct option in queries", async () => {
    const contact = await client.contact.create({
      data: {
        firstName: "TestDistinct",
        lastName: "User",
      },
    });

    const contacts = await client.contact.find({
      where: { firstName: "TestDistinct" },
      select: { firstName: true, lastName: true },
      distinct: true,
    });

    expect(contacts).toHaveLength(1);
    expect(contacts[0].firstName).toBe("TestDistinct");
    expect(contacts[0].lastName).toBe("User");
  });

  it("should not return duplicate records on nested where", async () => {
    const c = await client.contact.create({
      data: {
        firstName: "Test",
        lastName: "User",
      },
    });

    const address = await client.address.create({
      data: {
        contact: { select: { id: c.id } },
        street: "Street 1",
      },
      select: { id: true, tags: true },
    });

    // create two tags and assign both of them to the address
    await Promise.all([
      client.addressTag.create({
        data: { name: "Red", address: { select: { id: address.id } } },
      }),
      client.addressTag.create({
        data: { name: "Blue", address: { select: { id: address.id } } },
      }),
    ]);

    const contact = await client.contact.findOne({
      where: { id: c.id },
      select: {
        id: true,
        addresses: {
          where: {
            tags: {
              OR: [{ name: "Red" }, { name: "Blue" }],
            },
          },
        },
      },
    });

    expect(contact).toBeDefined();
    expect(contact!.addresses).toBeDefined();
    expect(contact!.addresses).toHaveLength(1);
  });
});
