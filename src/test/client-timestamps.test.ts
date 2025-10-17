import { describe, expect, it } from "vitest";
import { getTestClient } from "./client.utils";

describe("client timestamp tests", async () => {
  const client = await getTestClient();

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
