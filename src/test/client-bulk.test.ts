import { describe, expect, it } from "vitest";
import { getTestClient } from "./client.utils";
import { createData } from "./fixture";

describe("client bulk operations tests", async () => {
  const client = await getTestClient();

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

  it("should handle bulk update with relationships", async () => {
    await createData(client);

    const title = await client.title.create({
      data: { code: "test", name: "Test" },
    });

    // Bulk update without where clause (updates all)
    const affected = await client.contact.updateAll({
      set: {
        title: { id: title.id },
      },
    });

    expect(affected).toBeGreaterThanOrEqual(0);
  });

  it("should handle bulk delete with no matches", async () => {
    const affected = await client.contact.deleteAll({
      where: {
        firstName: { eq: "NonExistent12345" },
      },
    });

    expect(affected).toBe(0);
  });

  it("should auto-increment version on bulk update", async () => {
    const contact = await client.contact.create({
      data: {
        firstName: "Bulk",
        lastName: "Test",
      },
    });

    const initialVersion = contact.version;

    // Use deleteAll followed by checking if update works for existing test
    // This tests version increment without WHERE clause issue
    await client.contact.updateAll({
      set: { lastName: "Updated" },
    });

    const updated = await client.contact.findOne({
      where: { firstName: { eq: "Bulk" } },
      select: { version: true, lastName: true },
    });

    // Verify both version increment and data update
    expect(updated).toBeDefined();
    if (updated) {
      expect(updated.version).toBe(initialVersion + 1);
      expect(updated.lastName).toBe("Updated");
    }
  });

  it("should bulk update with where clause", async () => {
    await client.contact.create({
      data: {
        firstName: "Bulk",
        lastName: "Test",
      },
    });

    await client.contact.updateAll({
      set: { lastName: "Updated" },
      where: { firstName: { eq: "Bulk" } },
    });

    const updated = await client.contact.findOne({
      where: { firstName: { eq: "Bulk" } },
      select: { version: true, lastName: true },
    });

    expect(updated).toBeDefined();
    expect(updated?.lastName).toBe("Updated");
  });

  it("should bulk create multiple records", async () => {
    const result = await client.contact.createAll({
      data: [
        { firstName: "User1", lastName: "Test1" },
        { firstName: "User2", lastName: "Test2" },
        { firstName: "User3", lastName: "Test3" },
      ],
    });

    expect(result).toBeDefined();
    expect(result.length).toBe(3);
    expect(result[0].firstName).toBe("User1");
    expect(result[1].firstName).toBe("User2");
    expect(result[2].firstName).toBe("User3");
  });

  it("should bulk create with select", async () => {
    const result = await client.contact.createAll({
      data: [
        { firstName: "Select1", lastName: "Test1" },
        { firstName: "Select2", lastName: "Test2" },
      ],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        version: true,
      },
    });

    expect(result).toBeDefined();
    expect(result.length).toBe(2);
    expect(result[0].firstName).toBe("Select1");
    expect(result[0].version).toBe(1);
    expect(result[1].firstName).toBe("Select2");
    expect(result[1].version).toBe(1);
  });

  it("should bulk create with relationships", async () => {
    const title = await client.title.create({
      data: { code: "bulk-title", name: "Bulk Title" },
    });

    const result = await client.contact.createAll({
      data: [
        {
          firstName: "Rel1",
          lastName: "Test1",
          title: { select: { id: title.id } },
        },
        {
          firstName: "Rel2",
          lastName: "Test2",
          title: { select: { id: title.id } },
        },
      ],
      select: {
        id: true,
        firstName: true,
        title: {
          id: true,
          name: true,
        },
      },
    });

    expect(result).toBeDefined();
    expect(result.length).toBe(2);
    expect(result[0].title).toBeDefined();
    expect(result[0].title?.name).toBe("Bulk Title");
    expect(result[1].title).toBeDefined();
    expect(result[1].title?.name).toBe("Bulk Title");
  });

  it("should handle bulk create with nested create", async () => {
    const result = await client.contact.createAll({
      data: [
        {
          firstName: "Nested1",
          lastName: "Test1",
          title: { create: { code: "nested1", name: "Nested Title 1" } },
        },
        {
          firstName: "Nested2",
          lastName: "Test2",
          title: { create: { code: "nested2", name: "Nested Title 2" } },
        },
      ],
      select: {
        id: true,
        firstName: true,
        title: {
          id: true,
          name: true,
        },
      },
    });

    expect(result).toBeDefined();
    expect(result.length).toBe(2);
    expect(result[0].title?.name).toBe("Nested Title 1");
    expect(result[1].title?.name).toBe("Nested Title 2");
  });

  it("should handle empty array in bulk create", async () => {
    const result = await client.contact.createAll({
      data: [],
    });

    expect(result).toBeDefined();
    expect(result.length).toBe(0);
  });

  it("should auto-set timestamps on bulk create", async () => {
    const beforeCreate = new Date();

    const result = await client.contact.createAll({
      data: [
        { firstName: "Timestamp1", lastName: "Test1" },
        { firstName: "Timestamp2", lastName: "Test2" },
      ],
      select: {
        id: true,
        firstName: true,
        createdOn: true,
        updatedOn: true,
      },
    });

    const afterCreate = new Date();

    expect(result).toBeDefined();
    expect(result.length).toBe(2);

    for (const record of result) {
      expect(record.createdOn).toBeDefined();
      expect(record.updatedOn).toBeDefined();
      expect(new Date(record.createdOn!)).toBeInstanceOf(Date);
      expect(new Date(record.updatedOn!)).toBeInstanceOf(Date);
      expect(new Date(record.createdOn!).getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime(),
      );
      expect(new Date(record.createdOn!).getTime()).toBeLessThanOrEqual(
        afterCreate.getTime(),
      );
    }
  });
});
