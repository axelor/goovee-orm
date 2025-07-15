import { beforeEach, describe, expect, it } from "vitest";
import { QueryOptions } from "../client";
import { getTestClient } from "./client.utils";
import { AddressType, Contact } from "./db/models";
import { createData } from "./fixture";

describe("client tests", async () => {
  const client = await getTestClient();
  it("should create a record", async () => {
    const res = await client.title.create({
      data: {
        code: "mr",
        name: "Mr.",
      },
    });
    expect(res).toMatchObject({
      id: "1",
      version: 1,
      code: "mr",
      name: "Mr.",
    });
  });

  it("should create a record and return selected fields", async () => {
    const res = await client.title.create({
      data: {
        code: "mr",
        name: "Mr.",
      },
      select: {
        name: true,
      },
    });
    expect(res).toMatchObject({
      id: "1",
      version: 1,
      name: "Mr.",
    });
    expect(res).toHaveProperty("code", undefined);
  });

  it("should create record with nested records", async () => {
    const res = await client.contact.create({
      data: {
        firstName: "Some",
        lastName: "NAME",
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
              street: "My HOME",
              type: AddressType.Home,
            },
            {
              contact: {},
              street: "My Office",
              type: AddressType.Office,
            },
          ],
        },
        circles: {
          create: [
            {
              code: "family",
              name: "Family",
            },
            {
              code: "friemds",
              name: "Friends",
            },
          ],
        },
      },
      select: {
        firstName: true,
        lastName: true,
        title: {
          code: true,
          name: true,
        },
        addresses: {
          select: {
            type: true,
            street: true,
          },
        },
        circles: {
          select: {
            name: true,
          },
        },
      },
    });

    const x = await client.address.find({
      select: {
        id: true,
        contact: {
          id: true,
        },
      },
    });

    expect(res).toMatchObject({
      id: "1",
      version: 1,
      firstName: "Some",
      lastName: "NAME",
      title: {
        id: "1",
        version: 1,
        code: "mr",
        name: "Mr.",
      },
      addresses: [
        {
          id: "1",
          version: 1,
          type: "home",
          street: "My HOME",
        },
        {
          id: "2",
          version: 1,
          type: "office",
          street: "My Office",
        },
      ],
      circles: [
        {
          id: "1",
          version: 1,
          name: "Family",
        },
        {
          id: "2",
          version: 1,
          name: "Friends",
        },
      ],
    });
  });

  it("should create record and select references", async () => {
    await client.title.create({
      data: {
        code: "mr",
        name: "Mr.",
      },
    });
    await client.circle.create({
      data: {
        code: "family",
        name: "Family",
      },
    });
    const res = await client.contact.create({
      data: {
        firstName: "Some",
        lastName: "NAME",
        title: {
          select: {
            code: "mr",
          },
        },
        circles: {
          select: [
            {
              code: "family",
            },
          ],
        },
      },
      select: {
        firstName: true,
        lastName: true,
        title: {
          code: true,
          name: true,
        },
        circles: {
          select: {
            name: true,
          },
        },
      },
    });
    expect(res).toMatchObject({
      id: "1",
      version: 1,
      firstName: "Some",
      lastName: "NAME",
      title: {
        id: "1",
        version: 1,
        code: "mr",
        name: "Mr.",
      },
      circles: [
        {
          id: "1",
          version: 1,
          name: "Family",
        },
      ],
    });
  });

  it("should update record", async () => {
    const mr = await client.title.create({
      data: {
        code: "mr",
        name: "Mr.",
      },
    });
    const res = await client.title.update({
      data: {
        id: mr.id,
        version: mr.version,
        name: "MR",
      },
      select: {
        name: true,
      },
    });
    expect(res).toMatchObject({
      id: "1",
      version: 2,
      name: "MR",
    });
  });

  it("should update nested record", async () => {
    const c = await client.contact.create({
      data: {
        firstName: "Some",
        lastName: "Name",
        title: {
          create: {
            code: "mr",
            name: "Mr.",
          },
        },
      },
      select: {
        title: {
          id: true,
          version: true,
        },
      },
    });

    if (c.title) {
      const res = await client.contact.update({
        data: {
          id: c.id,
          version: c.version,
          title: {
            update: {
              id: c.title.id,
              version: c.title.version,
              name: "MR",
            },
          },
        },
        select: {
          id: true,
          title: {
            name: true,
          },
        },
      });

      expect(res).toBeDefined();
      expect(res.title).toBeDefined();
      expect(res.title?.name).toBe("MR");
    }
  });

  it("should update record and select reference", async () => {
    await client.title.create({
      data: {
        code: "mr",
        name: "Mr.",
      },
    });
    const c = await client.contact.create({
      data: {
        firstName: "Some",
        lastName: "NAME",
        title: {
          create: {
            code: "mrs",
            name: "Mrs",
          },
        },
      },
      select: {
        firstName: true,
        lastName: true,
        title: {
          code: true,
          name: true,
        },
      },
    });

    expect(c?.title?.name).toBe("Mrs");

    const x = await client.contact.update({
      data: {
        id: c.id,
        version: c.version,
        lastName: "Name",
        title: {
          select: {
            code: "mr",
          },
        },
      },
      select: {
        firstName: true,
        lastName: true,
        title: {
          code: true,
          name: true,
        },
      },
    });

    expect(x.lastName).toBe("Name");
    expect(x.title?.name).toBe("Mr.");
    expect(x.version).toBe(c.version + 1);
  });

  it("should remove a collection field item with update", async () => {
    const contact = await client.contact.create({
      data: {
        firstName: "Some",
        lastName: "NAME",
        addresses: {
          create: {
            contact: {},
            street: "My HOME",
          },
        },
      },
      select: {
        addresses: {
          select: {
            street: true,
          },
        },
      },
    });

    expect(contact).toBeDefined();
    expect(contact.addresses).toHaveLength(1);
    expect(contact.addresses![0].street).toBe("My HOME");

    const updated = await client.contact.update({
      data: {
        id: contact.id,
        version: contact.version,
        addresses: {
          create: [
            {
              contact: {},
              street: "My OFFICE",
            },
          ],
          remove: contact.addresses![0].id,
        },
      },
      select: {
        addresses: {
          select: {
            street: true,
          },
        },
      },
    });

    expect(updated.addresses).toHaveLength(1);
    expect(updated.addresses![0].street).toBe("My OFFICE");
  });

  it("should handle bi-directional one-to-one", async () => {
    const c = await client.contact.create({
      data: {
        firstName: "Some",
        lastName: "Name",
        bio: {
          create: {
            contact: {},
            content: "It's Me!",
          },
        },
      },
      select: {
        firstName: true,
        lastName: true,
        bio: {
          content: true,
        },
      },
    });

    expect(c).toMatchObject({
      id: "1",
      version: 1,
      firstName: "Some",
      lastName: "Name",
      bio: { id: "1", version: 1, content: "It's Me!" },
    });

    const b = await client.bio.create({
      data: {
        content: "It's me again!",
        contact: {
          create: {
            firstName: "Some",
            lastName: "NAME",
          },
        },
      },
      select: {
        content: true,
        contact: {
          firstName: true,
          lastName: true,
        },
      },
    });

    expect(b).toMatchObject({
      id: "2",
      version: 1,
      content: "It's me again!",
      contact: {
        id: "2",
        version: 2,
        firstName: "Some",
        lastName: "NAME",
      },
    });
  });

  it("should handle bi-directional many-to-many", async () => {
    const client = await getTestClient();
    const res = await client.circle.create({
      data: {
        code: "friends",
        name: "Friends",
        contacts: {
          create: [
            {
              firstName: "Some",
              lastName: "Name",
            },
            {
              firstName: "Another",
              lastName: "Name",
            },
          ],
        },
      },
      select: {
        code: true,
        name: true,
        contacts: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    expect(res).toMatchObject({
      id: "1",
      version: 1,
      code: "friends",
      name: "Friends",
      contacts: [
        {
          id: "1",
          version: 1,
          firstName: "Some",
          lastName: "Name",
        },
        {
          id: "2",
          version: 1,
          firstName: "Another",
          lastName: "Name",
        },
      ],
    });
  });

  it("should find", async () => {
    await createData(client);
    const res = await client.contact.findOne({
      select: {
        firstName: true,
        lastName: true,
        title: {
          name: true,
        },
        fullName: true,
        addresses: {
          select: {
            street: true,
          },
        },
      },
      where: {
        id: 1,
      },
      orderBy: {
        firstName: "DESC",
        title: {
          name: "ASC",
        },
        addresses: {
          city: "DESC",
          country: {
            name: "ASC",
          },
          contact: {
            lastName: "DESC",
          },
        },
      },
    });

    expect(res).toBeInstanceOf(Contact);
    expect(res!.id).toBeTruthy();
    expect(res!.title).toBeDefined();
    expect(res!.addresses).toBeDefined();
    expect(res!.addresses?.length).toBeGreaterThan(0);
  });

  it("should count", async () => {
    await createData(client);
    const titleCount = await client.title.count();
    expect(titleCount).toBe(2);
  });

  it("should bulk update", async () => {
    await createData(client);
    const bulkUpdated = await client.contact.updateAll({
      set: {
        lastName: "NAME",
        title: {
          id: null,
        },
      },
    });

    expect(bulkUpdated).toBeGreaterThan(0);

    const afterBulkUpdate = await client.contact.findOne({
      select: {
        lastName: true,
        title: {
          id: true,
        },
      },
      where: { id: 1 },
    });

    expect(afterBulkUpdate).toBeDefined();
    expect(afterBulkUpdate!.lastName).toBe("NAME");
    expect(afterBulkUpdate!.title).toBeNull();
  });

  it("should bulk delete", async () => {
    await createData(client);
    const count = await client.address.count({
      where: {
        city: {
          like: "%s%",
        },
      },
    });
    const bulkDeleted = await client.address.deleteAll({
      where: {
        city: {
          like: "%s%",
        },
      },
    });
    expect(bulkDeleted).toBe(+count);
  });

  it("should bulk delete with join", async () => {
    await createData(client);
    const count = await client.address.count({
      where: {
        country: {
          code: {
            eq: "fr",
          },
        },
      },
    });
    const bulkDeleted = await client.address.deleteAll({
      where: {
        country: {
          code: {
            eq: "fr",
          },
        },
      },
    });
    expect(bulkDeleted).toBe(+count);
  });

  it("should handle text, json and binary fields", async () => {
    // when working with binary fields, always use transaction
    await client.$transaction(async (c) => {
      const res = await c.contact.create({
        data: {
          firstName: "some",
          lastName: "name",
          attrs: Promise.resolve({
            some: "name",
            thing: [1, 2, 3],
          }),
          notes: Promise.resolve("Some Notes"),
          image: Promise.resolve(Buffer.from("Hello!!!", "ascii")),
        },
        select: {
          attrs: true,
          notes: true,
          image: true,
        },
      });

      expect(res.image).toBeInstanceOf(Promise);
      expect(res.notes).toBeInstanceOf(Promise);
      expect(res.attrs).toBeInstanceOf(Promise);
      expect((await res.image)?.toString()).toBe("Hello!!!");
      expect(await res.notes).toBe("Some Notes");
      expect(await res.attrs).toMatchObject({
        some: "name",
        thing: [1, 2, 3],
      });
    });
  });

  it("should filter record using 'NE' on boolean", async () => {
    const india = await client.country.create({
      data: {
        code: "IN",
        name: "India",
        isMember: true,
      },
    });

    const france = await client.country.create({
      data: {
        code: "FR",
        name: "France",
      },
    });

    const germany = await client.country.create({
      data: {
        code: "DE",
        name: "Germany",
      },
    });

    const memberCountries = await client.country.find({
      where: {
        isMember: {
          eq: true,
        },
      },
    });

    const nonMemberCountries = await client.country.find({
      where: {
        isMember: {
          ne: true,
          eq: null,
        },
      },
    });

    expect(memberCountries).toHaveLength(1);
    expect(nonMemberCountries).toHaveLength(2);
  });

  it("should filter decimal values", async () => {
    const US = await client.country.create({
      data: {
        code: "US",
        name: "United States",
        population: "33.23",
      },
    });
    const UK = await client.country.create({
      data: {
        code: "UK",
        name: "United Kingdom",
        population: "6.80",
      },
    });
    const CN = await client.country.create({
      data: {
        code: "CN",
        name: "China",
        population: "140.56",
      },
    });
    const found = await client.country.find({
      where: {
        population: {
          gt: "30",
        },
      },
    });
    expect(found).toHaveLength(2);
    expect(found.map((x) => x.code)).toContain("US");
    expect(found.map((x) => x.code)).toContain("CN");
  });
});

describe("client pagination tests", async () => {
  const client = await getTestClient();

  beforeEach(async () => createData(client, 20));

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
});
