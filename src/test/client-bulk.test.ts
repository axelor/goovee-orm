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
});
