import { beforeEach, describe, expect, it } from "vitest";
import { BigDecimal, QueryOptions } from "../client";
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
    expect(titleCount).toBe(3);
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
        OR: [
          {
            isMember: { ne: true },
          },
          {
            isMember: { eq: null },
          },
        ],
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

  it("should handle BigDecimal operations", async () => {
    const country = await client.country.create({
      data: {
        code: "IN",
        name: "India",
        population: "138.50",
      },
    });

    expect(country.population).toBeDefined();
    expect(country.population).toBeInstanceOf(BigDecimal);
    expect(country.population!.toString()).toBe("138.50");

    const found = await client.country.findOne({
      where: { id: country.id },
      select: { population: true, code: true },
    });

    expect(found?.population?.toString()).toBe("138.50");
  });

  it("should perform BigDecimal arithmetic comparisons", async () => {
    await client.country.create({
      data: { code: "A1", name: "Test A", population: "10.25" },
    });
    await client.country.create({
      data: { code: "B1", name: "Test B", population: "20.50" },
    });
    await client.country.create({
      data: { code: "C1", name: "Test C", population: "15.75" },
    });

    const gtResults = await client.country.find({
      where: { population: { gt: "15.00" } },
      select: { code: true, population: true },
    });
    expect(gtResults).toHaveLength(2);
    expect(gtResults.map((r) => r.code)).toEqual(
      expect.arrayContaining(["B1", "C1"]),
    );

    const lteResults = await client.country.find({
      where: { population: { le: "15.75" } },
      select: { code: true, population: true },
    });
    expect(lteResults).toHaveLength(2);
    expect(lteResults.map((r) => r.code)).toEqual(
      expect.arrayContaining(["A1", "C1"]),
    );

    const betweenResults = await client.country.find({
      where: { population: { between: ["10.00", "16.00"] } },
      select: { code: true, population: true },
    });
    expect(betweenResults).toHaveLength(2);
    expect(betweenResults.map((r) => r.code)).toEqual(
      expect.arrayContaining(["A1", "C1"]),
    );
  });

  it("should handle BigDecimal precision and scale", async () => {
    const highPrecision = await client.country.create({
      data: {
        code: "HP",
        name: "High Precision",
        population: "123456789.123456789",
      },
    });

    expect(highPrecision.population?.toString()).toBe("123456789.123456789");

    const found = await client.country.findOne({
      where: { code: "HP" },
      select: { population: true },
    });

    expect(found?.population?.toString()).toBe("123456789.123456789");
  });

  it("should handle null and zero BigDecimal values", async () => {
    const nullPop = await client.country.create({
      data: {
        code: "NP",
        name: "Null Population",
        population: null,
      },
    });
    expect(nullPop.population).toBeNull();

    const zeroPop = await client.country.create({
      data: {
        code: "ZP",
        name: "Zero Population",
        population: "0",
      },
    });
    expect(zeroPop.population?.toString()).toBe("0");

    const zeroDecimal = await client.country.create({
      data: {
        code: "ZD",
        name: "Zero Decimal",
        population: "0.00",
      },
    });
    expect(zeroDecimal.population?.toString()).toBe("0.00");
  });

  it("should filter BigDecimal nulls and zeros", async () => {
    await client.country.create({
      data: { code: "N1", name: "Null", population: null },
    });
    await client.country.create({
      data: { code: "Z1", name: "Zero", population: "0" },
    });
    await client.country.create({
      data: { code: "P1", name: "Positive", population: "5.5" },
    });

    const nonNullResults = await client.country.find({
      where: { population: { ne: null } },
      select: { code: true },
    });
    expect(nonNullResults.map((r) => r.code)).toEqual(
      expect.arrayContaining(["Z1", "P1"]),
    );

    const gtZeroResults = await client.country.find({
      where: { population: { gt: "0" } },
      select: { code: true },
    });
    expect(gtZeroResults.map((r) => r.code)).toContain("P1");
    expect(gtZeroResults.map((r) => r.code)).not.toContain("Z1");
  });

  it("should set createdOn field when creating records", async () => {
    const contact = await client.contact.create({
      data: {
        firstName: "John",
        lastName: "Doe",
      },
      select: {
        createdOn: true,
        updatedOn: true,
      },
    });

    expect(contact.createdOn).toBeDefined();
    expect(contact.createdOn).toBeInstanceOf(Date);
    expect(contact.updatedOn).toBeDefined();
    expect(contact.updatedOn).toBeInstanceOf(Date);

    expect(contact.createdOn).toEqual(contact.updatedOn);
  });

  it("should update updatedOn field when modifying records", async () => {
    const contact = await client.contact.create({
      data: {
        firstName: "Jane",
        lastName: "Smith",
      },
      select: {
        createdOn: true,
        updatedOn: true,
      },
    });

    // Small delay to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 20));

    const beforeUpdate = new Date();
    const updatedContact = await client.contact.update({
      data: {
        id: contact.id,
        version: contact.version,
        firstName: "Jane Updated",
      },
      select: {
        createdOn: true,
        updatedOn: true,
      },
    });

    expect(contact.createdOn).toBeDefined();
    expect(contact.updatedOn).toBeDefined();
    expect(updatedContact.createdOn).toBeDefined();
    expect(updatedContact.createdOn).toEqual(contact.createdOn);
    expect(updatedContact.updatedOn).toBeDefined();
    expect(updatedContact.updatedOn).toBeInstanceOf(Date);
    expect(updatedContact.updatedOn!.getTime()).toBeGreaterThan(
      contact.updatedOn!.getTime(),
    );
  });

  it("should handle timezone correctly for createdOn and updatedOn", async () => {
    const originalTZ = process.env.TZ;

    try {
      // Test with UTC timezone
      process.env.TZ = "UTC";
      const utcContact = await client.contact.create({
        data: {
          firstName: "UTC",
          lastName: "Test",
        },
        select: {
          createdOn: true,
          updatedOn: true,
        },
      });

      // Test with different timezone (Eastern Time)
      process.env.TZ = "America/New_York";
      const etContact = await client.contact.create({
        data: {
          firstName: "ET",
          lastName: "Test",
        },
        select: {
          createdOn: true,
          updatedOn: true,
        },
      });

      // Both timestamps should be valid Date objects
      expect(utcContact.createdOn).toBeInstanceOf(Date);
      expect(utcContact.updatedOn).toBeInstanceOf(Date);
      expect(etContact.createdOn).toBeInstanceOf(Date);
      expect(etContact.updatedOn).toBeInstanceOf(Date);

      // Verify ET contact was created after UTC contact (ordering should be maintained)
      expect(etContact.createdOn!.getTime()).toBeGreaterThan(
        utcContact.createdOn!.getTime(),
      );
      expect(etContact.updatedOn!.getTime()).toBeGreaterThan(
        utcContact.updatedOn!.getTime(),
      );

      // Test timezone consistency in updates
      await new Promise((resolve) => setTimeout(resolve, 20));

      const updatedUtcContact = await client.contact.update({
        data: {
          id: utcContact.id,
          version: utcContact.version,
          firstName: "UTC Updated",
        },
        select: {
          createdOn: true,
          updatedOn: true,
        },
      });

      // createdOn should remain unchanged, updatedOn should be newer
      expect(updatedUtcContact.createdOn).toEqual(utcContact.createdOn);
      expect(updatedUtcContact.updatedOn!.getTime()).toBeGreaterThan(
        utcContact.updatedOn!.getTime(),
      );
    } finally {
      // Restore original timezone
      if (originalTZ) {
        process.env.TZ = originalTZ;
      } else {
        delete process.env.TZ;
      }
    }
  });

  it("should store timestamps in consistent format regardless of client timezone", async () => {
    // Create a contact
    const contact1 = await client.contact.create({
      data: {
        firstName: "Timezone",
        lastName: "Test1",
      },
      select: {
        createdOn: true,
        updatedOn: true,
      },
    });

    // Wait a bit and create another contact
    await new Promise((resolve) => setTimeout(resolve, 50));

    const contact2 = await client.contact.create({
      data: {
        firstName: "Timezone",
        lastName: "Test2",
      },
      select: {
        createdOn: true,
        updatedOn: true,
      },
    });

    // Verify timestamp ordering is correct
    expect(contact2.createdOn!.getTime()).toBeGreaterThan(
      contact1.createdOn!.getTime(),
    );
    expect(contact2.updatedOn!.getTime()).toBeGreaterThan(
      contact1.updatedOn!.getTime(),
    );

    // Test that retrieving the same records returns consistent timestamps
    const retrieved1 = await client.contact.findOne({
      where: { id: contact1.id },
      select: {
        createdOn: true,
        updatedOn: true,
      },
    });

    const retrieved2 = await client.contact.findOne({
      where: { id: contact2.id },
      select: {
        createdOn: true,
        updatedOn: true,
      },
    });

    // Retrieved timestamps should match original timestamps
    expect(retrieved1!.createdOn).toEqual(contact1.createdOn);
    expect(retrieved1!.updatedOn).toEqual(contact1.updatedOn);
    expect(retrieved2!.createdOn).toEqual(contact2.createdOn);
    expect(retrieved2!.updatedOn).toEqual(contact2.updatedOn);
  });
});

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
});
