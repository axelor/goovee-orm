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

  it("should perform simple _count aggregation", async () => {
    // Setup test data for this test
    await setupTestData(client);

    const result = await client.contact.aggregate({
      _count: {
        id: true,
        firstName: true,
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    
    const first = result[0];
    expect(first._count).toBeDefined();
    expect(first._count.id).toBeTypeOf("number");
    expect(first._count.firstName).toBeTypeOf("number");
    expect(first._count.id).toBeGreaterThan(0);
    expect(first._count.firstName).toBeGreaterThan(0);
  });

  it("should perform _count with relations", async () => {
    await setupTestData(client);

    const result = await client.contact.aggregate({
      _count: {
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
      expect(first._count).toBeDefined();
      expect(first._count.title).toBeDefined();
      expect(first._count.title.id).toBeTypeOf("number");
      expect(first._count.addresses).toBeDefined();
      expect(first._count.addresses.id).toBeTypeOf("number");
    }
  });

  it("should perform _avg aggregation", async () => {
    await setupTestData(client);

    const result = await client.contact.aggregate({
      _avg: {
        version: true,
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    
    if (result.length > 0) {
      const first = result[0];
      expect(first._avg).toBeDefined();
      expect(first._avg.version).toBeTypeOf("number");
    }
  });

  it("should perform _sum aggregation", async () => {
    await setupTestData(client);

    const result = await client.contact.aggregate({
      _sum: {
        version: true,
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    
    if (result.length > 0) {
      const first = result[0];
      expect(first._sum).toBeDefined();
      // Sum can be null if no valid values exist, or a number
      expect(first._sum.version === null || typeof first._sum.version === "number").toBe(true);
    }
  });

  it("should perform _min and _max aggregations", async () => {
    await setupTestData(client);

    const result = await client.contact.aggregate({
      _min: {
        version: true,
        firstName: true,
      },
      _max: {
        version: true,
        lastName: true,
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    
    if (result.length > 0) {
      const first = result[0];
      expect(first._min).toBeDefined();
      expect(first._min.version).toBeTypeOf("number");
      expect(first._min.firstName).toBeTypeOf("string");
      expect(first._max).toBeDefined();
      expect(first._max.version).toBeTypeOf("number");
      expect(first._max.lastName).toBeTypeOf("string");
    }
  });

  it("should perform multiple aggregate operations together", async () => {
    await setupTestData(client);

    const result = await client.contact.aggregate({
      _count: {
        id: true,
      },
      _avg: {
        version: true,
      },
      _sum: {
        version: true,
      },
      _min: {
        firstName: true,
      },
      _max: {
        lastName: true,
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    
    if (result.length > 0) {
      const first = result[0];
      expect(first._count).toBeDefined();
      expect(first._count.id).toBeTypeOf("number");
      expect(first._avg).toBeDefined();
      expect(first._avg.version === null || typeof first._avg.version === "number").toBe(true);
      expect(first._sum).toBeDefined();
      expect(first._sum.version === null || typeof first._sum.version === "number").toBe(true);
      expect(first._min).toBeDefined();
      expect(first._min.firstName).toBeTypeOf("string");
      expect(first._max).toBeDefined();
      expect(first._max.lastName).toBeTypeOf("string");
    }
  });

  it("should perform groupBy with simple fields", async () => {
    const result = await client.contact.aggregate({
      _count: {
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
      expect(first._count).toBeDefined();
      expect(first._count.id).toBeTypeOf("number");
      expect(first.groupBy).toBeDefined();
      expect(first.groupBy.firstName).toBeDefined();
      expect(first.groupBy.version).toBeDefined();
    }
  });

  it("should perform groupBy with relations", async () => {
    const result = await client.contact.aggregate({
      _count: {
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
      expect(first._count).toBeDefined();
      expect(first._count.id).toBeTypeOf("number");
      expect(first.groupBy).toBeDefined();
      expect(first.groupBy.title).toBeDefined();
      expect(first.groupBy.title.id).toBeDefined();
    }
  });

  it("should perform groupBy with nested relations", async () => {
    const result = await client.contact.aggregate({
      _count: {
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
      expect(first._count).toBeDefined();
      expect(first._count.id).toBeTypeOf("number");
      expect(first.groupBy).toBeDefined();
      expect(first.groupBy.addresses).toBeDefined();
      expect(first.groupBy.addresses.country).toBeDefined();
      expect(first.groupBy.addresses.country.id).toBeDefined();
    }
  });

  it("should perform aggregates with where conditions", async () => {
    const result = await client.contact.aggregate({
      _count: {
        id: true,
      },
      _avg: {
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
      expect(first._count).toBeDefined();
      expect(first._count.id).toBeTypeOf("number");
      expect(first._avg).toBeDefined();
      expect(first._avg.version === null || typeof first._avg.version === "number").toBe(true);
    }
  });

  it("should perform having conditions", async () => {
    const result = await client.contact.aggregate({
      _count: {
        id: true,
      },
      _avg: {
        version: true,
      },
      groupBy: {
        firstName: true,
      },
      having: {
        _count: {
          id: { gt: 0 },
        },
        _avg: {
          version: { ge: 1.0 },
        },
      },
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    
    if (result.length > 0) {
      const first = result[0];
      expect(first._count).toBeDefined();
      expect(first._count.id).toBeTypeOf("number");
      expect(first._count.id).toBeGreaterThan(0);
      expect(first._avg).toBeDefined();
      expect(first._avg.version).toBeTypeOf("number");
      expect(first._avg.version).toBeGreaterThanOrEqual(1.0);
      expect(first.groupBy).toBeDefined();
      expect(first.groupBy.firstName).toBeDefined();
    }
  });

  it("should perform complete aggregate query with all features", async () => {
    const result = await client.contact.aggregate({
      _count: {
        id: true,
        addresses: {
          id: true,
        },
      },
      _avg: {
        version: true,
      },
      _max: {
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
        _avg: {
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
      expect(first._count).toBeDefined();
      expect(first._count.id).toBeTypeOf("number");
      expect(first._count.addresses).toBeDefined();
      expect(first._count.addresses.id).toBeTypeOf("number");
      expect(first._avg).toBeDefined();
      expect(first._avg.version).toBeTypeOf("number");
      expect(first._avg.version).toBeLessThan(100);
      expect(first._max).toBeDefined();
      expect(first._max.firstName).toBeTypeOf("string");
      expect(first.groupBy).toBeDefined();
      expect(first.groupBy.lastName).toBeDefined();
      expect(first.groupBy.title).toBeDefined();
      expect(first.groupBy.title.id).toBeDefined();
    }
  });

  it("should handle nested aggregate with complex aliasMap", async () => {
    await setupTestData(client);

    const result = await client.contact.aggregate({
      _avg: {
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
      expect(first._avg).toBeDefined();
      expect(first._avg.addresses).toBeDefined();
      expect(first._avg.addresses.country).toBeDefined();
      expect(first._avg.addresses.country.version === null || typeof first._avg.addresses.country.version === "number").toBe(true);
    }
  });

  it("should handle duplicate field names with unique aliases", async () => {
    await setupTestData(client);

    const result = await client.contact.aggregate({
      _avg: {
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
      expect(first._avg).toBeDefined();
      expect(first._avg.version === null || typeof first._avg.version === "number").toBe(true);
      expect(first._avg.addresses).toBeDefined();
      expect(first._avg.addresses.country).toBeDefined();
      expect(first._avg.addresses.country.version === null || typeof first._avg.addresses.country.version === "number").toBe(true);
      
      // They should be different values since they come from different tables (if both not null)
      if (first._avg.version !== null && first._avg.addresses.country.version !== null) {
        expect(first._avg.version).not.toBe(first._avg.addresses.country.version);
      }
    }
  });

  it("should return result with zero count when no data matches criteria", async () => {
    await setupTestData(client);

    const result = await client.contact.aggregate({
      _count: {
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
    expect(first._count).toBeDefined();
    expect(first._count.id).toBe(0);
  });
});