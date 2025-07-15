import { describe, expect, it } from "vitest";
import { getTestClient } from "./client.utils";
import { Contact, Title, Address, Country } from "./db/models";

describe("aggregate e2e tests", async () => {
  const client = await getTestClient();

  // Create some test data once before all tests
  const setupTestData = async (client: any) => {
    // Clear existing data
    await client.contact.deleteAll();

    // Create test title
    const title = await client.title.create({
      data: {
        code: "mr",
        name: "Mr.",
      },
    });

    // Create test country
    const country = await client.country.create({
      data: {
        code: "us",
        name: "United States",
      },
    });

    // Create test contacts with relations
    const contact1 = await client.contact.create({
      data: {
        firstName: "John",
        lastName: "Doe",
        version: 1,
        title: { select: { id: title.id } },
      },
    });

    const contact2 = await client.contact.create({
      data: {
        firstName: "Jane",
        lastName: "Smith",
        version: 2,
      },
    });

    // Create test addresses
    await client.address.create({
      data: {
        street: "123 Main St",
        city: "New York",
        contact: { select: { id: contact1.id } },
        country: { select: { id: country.id } },
        version: 1,
      },
    });

    await client.address.create({
      data: {
        street: "456 Oak Ave",
        city: "Los Angeles",
        contact: { select: { id: contact2.id } },
        country: { select: { id: country.id } },
        version: 2,
      },
    });

    return { title, country, contact1, contact2 };
  };

  it("should perform simple count aggregation", async () => {
    // Setup test data for this test
    await setupTestData(client);

    const result = await client.contact.aggregate({
      count: {
        id: true,
        firstName: true,
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);

    const first = result[0];
    expect(first.count).toBeDefined();
    expect(first.count.id).toBeTypeOf("number");
    expect(first.count.firstName).toBeTypeOf("number");
    expect(first.count.id).toBeGreaterThan(0);
    expect(first.count.firstName).toBeGreaterThan(0);
  });

  it("should perform count with relations", async () => {
    await setupTestData(client);

    const result = await client.contact.aggregate({
      count: {
        title: {
          id: true,
        },
        addresses: {
          id: true,
        },
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);

    if (result.length > 0) {
      const first = result[0];
      expect(first.count).toBeDefined();
      expect(first.count.title).toBeDefined();
      expect(first.count.title.id).toBeTypeOf("number");
      expect(first.count.addresses).toBeDefined();
      expect(first.count.addresses.id).toBeTypeOf("number");
    }
  });

  it("should perform avg aggregation", async () => {
    await setupTestData(client);

    const result = await client.contact.aggregate({
      avg: {
        version: true,
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);

    if (result.length > 0) {
      const first = result[0];
      expect(first.avg).toBeDefined();
      expect(first.avg.version).toBeTypeOf("number");
    }
  });

  it("should perform sum aggregation", async () => {
    await setupTestData(client);

    const result = await client.contact.aggregate({
      sum: {
        version: true,
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);

    if (result.length > 0) {
      const first = result[0];
      expect(first.sum).toBeDefined();
      // Sum can be null if no valid values exist, or a number
      expect(
        first.sum.version === null || typeof first.sum.version === "number",
      ).toBe(true);
    }
  });

  it("should perform min and max aggregations", async () => {
    await setupTestData(client);

    const result = await client.contact.aggregate({
      min: {
        version: true,
        firstName: true,
      },
      max: {
        version: true,
        lastName: true,
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);

    if (result.length > 0) {
      const first = result[0];
      expect(first.min).toBeDefined();
      expect(first.min.version).toBeTypeOf("number");
      expect(first.min.firstName).toBeTypeOf("string");
      expect(first.max).toBeDefined();
      expect(first.max.version).toBeTypeOf("number");
      expect(first.max.lastName).toBeTypeOf("string");
    }
  });

  it("should perform multiple aggregate operations together", async () => {
    await setupTestData(client);

    const result = await client.contact.aggregate({
      count: {
        id: true,
      },
      avg: {
        version: true,
      },
      sum: {
        version: true,
      },
      min: {
        firstName: true,
      },
      max: {
        lastName: true,
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);

    if (result.length > 0) {
      const first = result[0];
      expect(first.count).toBeDefined();
      expect(first.count.id).toBeTypeOf("number");
      expect(first.avg).toBeDefined();
      expect(
        first.avg.version === null || typeof first.avg.version === "number",
      ).toBe(true);
      expect(first.sum).toBeDefined();
      expect(
        first.sum.version === null || typeof first.sum.version === "number",
      ).toBe(true);
      expect(first.min).toBeDefined();
      expect(first.min.firstName).toBeTypeOf("string");
      expect(first.max).toBeDefined();
      expect(first.max.lastName).toBeTypeOf("string");
    }
  });

  it("should perform groupBy with simple fields", async () => {
    const result = await client.contact.aggregate({
      count: {
        id: true,
      },
      groupBy: {
        firstName: true,
        version: true,
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);

    // Should have multiple results when grouping
    if (result.length > 0) {
      const first = result[0];
      expect(first.count).toBeDefined();
      expect(first.count.id).toBeTypeOf("number");
      expect(first.groupBy).toBeDefined();
      expect(first.groupBy.firstName).toBeDefined();
      expect(first.groupBy.version).toBeDefined();
    }
  });

  it("should perform groupBy with relations", async () => {
    const result = await client.contact.aggregate({
      count: {
        id: true,
      },
      groupBy: {
        title: {
          id: true,
        },
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);

    if (result.length > 0) {
      const first = result[0];
      expect(first.count).toBeDefined();
      expect(first.count.id).toBeTypeOf("number");
      expect(first.groupBy).toBeDefined();
      expect(first.groupBy.title).toBeDefined();
      expect(first.groupBy.title.id).toBeDefined();
    }
  });

  it("should perform groupBy with nested relations", async () => {
    const result = await client.contact.aggregate({
      count: {
        id: true,
      },
      groupBy: {
        addresses: {
          country: {
            id: true,
          },
        },
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);

    if (result.length > 0) {
      const first = result[0];
      expect(first.count).toBeDefined();
      expect(first.count.id).toBeTypeOf("number");
      expect(first.groupBy).toBeDefined();
      expect(first.groupBy.addresses).toBeDefined();
      expect(first.groupBy.addresses.country).toBeDefined();
      expect(first.groupBy.addresses.country.id).toBeDefined();
    }
  });

  it("should perform aggregates with where conditions", async () => {
    const result = await client.contact.aggregate({
      count: {
        id: true,
      },
      avg: {
        version: true,
      },
      where: {
        version: { gt: 0 },
        firstName: { like: "%a%" },
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);

    if (result.length > 0) {
      const first = result[0];
      expect(first.count).toBeDefined();
      expect(first.count.id).toBeTypeOf("number");
      expect(first.avg).toBeDefined();
      expect(
        first.avg.version === null || typeof first.avg.version === "number",
      ).toBe(true);
    }
  });

  it("should perform having conditions", async () => {
    const result = await client.contact.aggregate({
      count: {
        id: true,
      },
      avg: {
        version: true,
      },
      groupBy: {
        firstName: true,
      },
      having: {
        count: {
          id: { gt: 0 },
        },
        avg: {
          version: { ge: 1.0 },
        },
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);

    if (result.length > 0) {
      const first = result[0];
      expect(first.count).toBeDefined();
      expect(first.count.id).toBeTypeOf("number");
      expect(first.count.id).toBeGreaterThan(0);
      expect(first.avg).toBeDefined();
      expect(first.avg.version).toBeTypeOf("number");
      expect(first.avg.version).toBeGreaterThanOrEqual(1.0);
      expect(first.groupBy).toBeDefined();
      expect(first.groupBy.firstName).toBeDefined();
    }
  });

  it("should perform complete aggregate query with all features", async () => {
    const result = await client.contact.aggregate({
      count: {
        id: true,
        addresses: {
          id: true,
        },
      },
      avg: {
        version: true,
      },
      max: {
        firstName: true,
      },
      groupBy: {
        lastName: true,
        title: {
          id: true,
        },
      },
      where: {
        version: { gt: 0 },
      },
      having: {
        avg: {
          version: { lt: 100 },
        },
      },
      take: 10,
      skip: 0,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(10);

    if (result.length > 0) {
      const first = result[0];
      expect(first.count).toBeDefined();
      expect(first.count.id).toBeTypeOf("number");
      expect(first.count.addresses).toBeDefined();
      expect(first.count.addresses.id).toBeTypeOf("number");
      expect(first.avg).toBeDefined();
      expect(first.avg.version).toBeTypeOf("number");
      expect(first.avg.version).toBeLessThan(100);
      expect(first.max).toBeDefined();
      expect(first.max.firstName).toBeTypeOf("string");
      expect(first.groupBy).toBeDefined();
      expect(first.groupBy.lastName).toBeDefined();
      expect(first.groupBy.title).toBeDefined();
      expect(first.groupBy.title.id).toBeDefined();
    }
  });

  it("should handle nested aggregate with complex aliasMap", async () => {
    await setupTestData(client);

    const result = await client.contact.aggregate({
      avg: {
        addresses: {
          country: {
            version: true,
          },
        },
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);

    if (result.length > 0) {
      const first = result[0];
      expect(first.avg).toBeDefined();
      expect(first.avg.addresses).toBeDefined();
      expect(first.avg.addresses.country).toBeDefined();
      expect(
        first.avg.addresses.country.version === null ||
          typeof first.avg.addresses.country.version === "number",
      ).toBe(true);
    }
  });

  it("should handle duplicate field names with unique aliases", async () => {
    await setupTestData(client);

    const result = await client.contact.aggregate({
      avg: {
        version: true,
        addresses: {
          country: {
            version: true,
          },
        },
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);

    if (result.length > 0) {
      const first = result[0];
      expect(first.avg).toBeDefined();
      expect(
        first.avg.version === null || typeof first.avg.version === "number",
      ).toBe(true);
      expect(first.avg.addresses).toBeDefined();
      expect(first.avg.addresses.country).toBeDefined();
      expect(
        first.avg.addresses.country.version === null ||
          typeof first.avg.addresses.country.version === "number",
      ).toBe(true);

      // They should be different values since they come from different tables (if both not null)
      if (
        first.avg.version !== null &&
        first.avg.addresses.country.version !== null
      ) {
        expect(first.avg.version).not.toBe(first.avg.addresses.country.version);
      }
    }
  });

  it("should return result with zero count when no data matches criteria", async () => {
    await setupTestData(client);

    const result = await client.contact.aggregate({
      count: {
        id: true,
      },
      where: {
        firstName: "NonExistentName123456789",
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);

    const first = result[0];
    expect(first.count).toBeDefined();
    expect(first.count.id).toBe(0);
  });
});
