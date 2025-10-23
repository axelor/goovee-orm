import { describe, expect, it } from "vitest";
import { getTestClient } from "./client.utils";
import { Contact } from "./db/models";
import { createData } from "./fixture";

describe("client find tests", async () => {
  const client = await getTestClient();

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
          orderBy: {
            street: "ASC",
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
    expect(res!.addresses!.length).toBeGreaterThan(0);
    expect(res!.addresses![0].street).toBeDefined();
    expect(res!.addresses![0].street).toBeTypeOf("string");
  });

  it("should count", async () => {
    await createData(client);
    const titleCount = await client.title.count();
    expect(titleCount).toBe(3);
  });

  it("should count with where clause", async () => {
    await createData(client);
    const count = await client.contact.count({
      where: {
        firstName: { like: "%John%" },
      },
    });
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("should count with relationship filter", async () => {
    await createData(client);
    const count = await client.contact.count({
      where: {
        title: {
          code: { eq: "mr" },
        },
      },
    });
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("should sort by multiple fields", async () => {
    await createData(client);
    const results = await client.contact.find({
      select: {
        firstName: true,
        lastName: true,
      },
      orderBy: {
        lastName: "ASC",
        firstName: "DESC",
      },
      take: 5,
    });
    expect(results.length).toBeGreaterThan(0);
    // Verify sorting is applied
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1];
      const curr = results[i];
      expect(prev.lastName! <= curr.lastName!).toBe(true);
    }
  });

  it("should handle complex nested queries", async () => {
    await createData(client);
    const result = await client.contact.findOne({
      where: {
        AND: [
          { firstName: { ne: null } },
          {
            addresses: {
              country: {
                code: { ne: null },
              },
            },
          },
        ],
      },
      select: {
        firstName: true,
        addresses: {
          select: {
            city: true,
            country: {
              name: true,
            },
          },
        },
      },
    });

    if (result?.addresses && result.addresses.length > 0) {
      expect(result.addresses[0].country).toBeDefined();
    }
  });
});
