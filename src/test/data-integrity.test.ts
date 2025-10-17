import { describe, expect, it } from "vitest";
import { getTestClient } from "./client.utils";

describe("data integrity tests", async () => {
  const client = await getTestClient();

  describe("relationship selection validation", () => {
    it("should throw error when selecting non-existent ManyToOne reference", async () => {
      await expect(
        client.contact.create({
          data: {
            firstName: "John",
            lastName: "Doe",
            title: {
              select: { code: "non-existent" },
            },
          },
        })
      ).rejects.toThrow(
        'Referenced Title not found with criteria: {"code":"non-existent"}'
      );
    });

    it("should throw error when selecting non-existent ManyToMany reference", async () => {
      const contact = await client.contact.create({
        data: {
          firstName: "John",
          lastName: "Doe",
        },
      });

      await expect(
        client.contact.update({
          data: {
            id: contact.id,
            version: contact.version,
            circles: {
              select: [{ code: "non-existent-circle" }],
            },
          },
        })
      ).rejects.toThrow(
        'Referenced Circle not found with criteria: {"code":"non-existent-circle"}'
      );
    });

  });

  describe("optimistic lock validation", () => {
    it("should throw error when update without id", async () => {
      await expect(
        client.contact.update({
          data: {
            id: undefined as any,
            version: 0,
            firstName: "Test",
          },
        })
      ).rejects.toThrow("Operation requires valid `id`");
    });

    it("should throw error when update without version", async () => {
      await expect(
        client.contact.update({
          data: {
            id: "1",
            version: undefined as any,
            firstName: "Test",
          },
        })
      ).rejects.toThrow("Operation requires valid `version`");
    });

    it("should throw error when delete without id", async () => {
      await expect(
        client.contact.delete({
          id: undefined as any,
          version: 0,
        })
      ).rejects.toThrow("Operation requires valid `id`");
    });

    it("should throw error when delete without version", async () => {
      await expect(
        client.contact.delete({
          id: "1",
          version: undefined as any,
        })
      ).rejects.toThrow("Operation requires valid `version`");
    });

    it("should throw error when version mismatch on update", async () => {
      const contact = await client.contact.create({
        data: {
          firstName: "John",
          lastName: "Doe",
        },
      });

      await expect(
        client.contact.update({
          data: {
            id: contact.id,
            version: 999,
            firstName: "Jane",
          },
        })
      ).rejects.toThrow(/optimistic lock.*failed/i);
    });

    it("should throw error when version mismatch on delete", async () => {
      const contact = await client.contact.create({
        data: {
          firstName: "John",
          lastName: "Doe",
        },
      });

      await expect(
        client.contact.delete({
          id: contact.id,
          version: 999,
        })
      ).rejects.toThrow(/optimistic lock.*failed/i);
    });

    it("should throw error when record not found", async () => {
      await expect(
        client.contact.update({
          data: {
            id: "99999",
            version: 0,
            firstName: "Test",
          },
        })
      ).rejects.toThrow(
        "Optimistic lock failed: Contact with id 99999 not found or has been modified (expected version 0)"
      );
    });
  });

  describe("bulk operations auto-update", () => {
    it("should auto-increment version on bulk update", async () => {
      const contact = await client.contact.create({
        data: {
          firstName: "John",
          lastName: "Doe",
        },
      });

      const initialVersion = contact.version;

      await client.contact.updateAll({
        set: {
          lastName: "Smith",
        },
      });

      const updated = await client.contact.findOne({
        where: { id: contact.id },
        select: {
          version: true,
          lastName: true,
        },
      });

      expect(updated!.version).toBe(initialVersion + 1);
      expect(updated!.lastName).toBe("Smith");
    });

    it("should auto-update timestamp on bulk update", async () => {
      const contact = await client.contact.create({
        data: {
          firstName: "John",
          lastName: "Doe",
        },
      });

      const initial = await client.contact.findOne({
        where: { id: contact.id },
        select: { updatedOn: true },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await client.contact.updateAll({
        set: {
          lastName: "Smith",
        },
      });

      const updated = await client.contact.findOne({
        where: { id: contact.id },
        select: { updatedOn: true },
      });

      expect(updated!.updatedOn!.getTime()).toBeGreaterThan(
        initial!.updatedOn!.getTime()
      );
    });
  });

  describe("concurrent modification scenarios", () => {
    it("should detect concurrent updates with optimistic locking", async () => {
      const contact = await client.contact.create({
        data: {
          firstName: "John",
          lastName: "Doe",
        },
      });

      // Simulate two users loading the same record
      const user1Record = await client.contact.findOne({
        where: { id: contact.id },
      });
      const user2Record = await client.contact.findOne({
        where: { id: contact.id },
      });

      // User 1 updates successfully
      await client.contact.update({
        data: {
          id: user1Record!.id,
          version: user1Record!.version,
          firstName: "Jane",
        },
      });

      // User 2 tries to update with stale version
      await expect(
        client.contact.update({
          data: {
            id: user2Record!.id,
            version: user2Record!.version,
            firstName: "Jack",
          },
        })
      ).rejects.toThrow(/optimistic lock.*failed/i);
    });

    it("should allow sequential updates with correct version", async () => {
      const contact = await client.contact.create({
        data: {
          firstName: "John",
          lastName: "Doe",
        },
      });

      let currentVersion = contact.version;

      for (let i = 1; i <= 3; i++) {
        const updated = await client.contact.update({
          data: {
            id: contact.id,
            version: currentVersion,
            firstName: `Name${i}`,
          },
          select: {
            version: true,
            firstName: true,
          },
        });

        expect(updated.version).toBe(currentVersion + 1);
        expect(updated.firstName).toBe(`Name${i}`);
        currentVersion = updated.version;
      }
    });
  });
});
