import { describe, expect, it } from "vitest";
import { getTestClient } from "./client.utils";
import { BigDecimal } from "@goovee/orm";
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
    expect(first.count.id).toBeTypeOf("string");
    expect(first.count.firstName).toBeTypeOf("string");
    expect(Number(first.count.id)).toBeGreaterThan(0);
    expect(Number(first.count.firstName)).toBeGreaterThan(0);
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
      expect(first.count.title.id).toBeTypeOf("string");
      expect(first.count.addresses).toBeDefined();
      expect(first.count.addresses.id).toBeTypeOf("string");
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
      expect(first.avg.version).toBeTypeOf("string");
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
        first.sum.version === null || typeof first.sum.version === "string",
      ).toBe(true);
    }
  });

  it("should return decimal sums as exact strings", async () => {
    await client.country.createAll({
      data: [
        { code: "d1", name: "Decimal One", population: "1.25" },
        { code: "d2", name: "Decimal Two", population: "2.5" },
      ],
    });

    const result = await client.country.aggregate({
      sum: { population: true },
      avg: { population: true },
      where: { code: { in: ["d1", "d2"] } },
    });

    // pg sums numerics exactly and the value passes through untouched —
    // no parseInt truncation (3), no float rounding
    expect(result[0].sum.population).toBe("3.75");
    expect(Number(result[0].avg.population)).toBe(1.875);
  });

  it("should return decimal min/max/groupBy values as BigDecimal, negatives included", async () => {
    await client.country.createAll({
      data: [
        { code: "g1", name: "Negative One", population: "-1.25" },
        { code: "g2", name: "Negative Two", population: "-2.5" },
      ],
    });

    const minMax = await client.country.aggregate({
      min: { population: true },
      max: { population: true },
      where: { code: { in: ["g1", "g2"] } },
    });

    expect(minMax[0].min.population).toBeInstanceOf(BigDecimal);
    expect(minMax[0].min.population!.equals(new BigDecimal("-2.5"))).toBe(true);
    expect(minMax[0].max.population!.equals(new BigDecimal("-1.25"))).toBe(
      true,
    );

    const groups = await client.country.aggregate({
      groupBy: { population: true },
      count: { id: true },
      where: { code: { in: ["g1", "g2"] } },
    });
    const values = groups
      .map((g) => Number(g.groupBy.population!.toString()))
      .sort((a, b) => a - b);

    expect(values).toEqual([-2.5, -1.25]);
  });

  it("should keep numeric-looking string group keys as strings", async () => {
    await client.country.create({
      data: { code: "007", name: "Bond", population: "1" },
    });

    const result = await client.country.aggregate({
      groupBy: { code: true },
      count: { id: true },
      where: { code: { in: ["007"] } },
    });

    expect(result[0].groupBy.code).toBe("007");
  });

  it("should keep bigint id aggregate values as strings", async () => {
    const c = await client.country.create({
      data: { code: "big1", name: "Big One" },
    });

    const result = await client.country.aggregate({
      groupBy: { id: true },
      count: { id: true },
      where: { code: { in: ["big1"] } },
    });

    expect(result[0].groupBy.id).toBe(String(c.id));
  });

  it("should return temporal aggregate values per their column types", async () => {
    await client.contact.createAll({
      data: [
        {
          firstName: "T1",
          lastName: "Temporal",
          registeredOn: new Date("2024-03-01T10:00:00Z"),
          dateOfBirth: "1990-05-15",
          timeOfBirth: "14:30:45",
        },
        {
          firstName: "T2",
          lastName: "Temporal",
          registeredOn: new Date("2024-03-02T10:00:00Z"),
          dateOfBirth: "1991-07-20",
          timeOfBirth: "09:15:00",
        },
      ],
    });

    const groups = await client.contact.aggregate({
      groupBy: { dateOfBirth: true, timeOfBirth: true, registeredOn: true },
      count: { id: true },
      where: { lastName: { in: ["Temporal"] } },
    });

    // date columns group as date strings (matching the model type), time
    // columns as time strings, timestamp columns as Date instances
    const dates = groups.map((g) => g.groupBy.dateOfBirth).sort();
    expect(dates).toEqual(["1990-05-15", "1991-07-20"]);
    expect(groups[0].groupBy.timeOfBirth).toMatch(/^\d{2}:\d{2}:\d{2}/);
    expect(groups[0].groupBy.registeredOn).toBeInstanceOf(Date);

    const minMax = await client.contact.aggregate({
      min: { dateOfBirth: true, registeredOn: true },
      max: { dateOfBirth: true },
      where: { lastName: { in: ["Temporal"] } },
    });

    expect(minMax[0].min.dateOfBirth).toBe("1990-05-15");
    expect(minMax[0].max.dateOfBirth).toBe("1991-07-20");
    expect(minMax[0].min.registeredOn).toBeInstanceOf(Date);
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
      expect(first.count.id).toBeTypeOf("string");
      expect(first.avg).toBeDefined();
      expect(
        first.avg.version === null || typeof first.avg.version === "string",
      ).toBe(true);
      expect(first.sum).toBeDefined();
      expect(
        first.sum.version === null || typeof first.sum.version === "string",
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
      expect(first.count.id).toBeTypeOf("string");
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
      expect(first.count.id).toBeTypeOf("string");
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
      expect(first.count.id).toBeTypeOf("string");
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
      expect(first.count.id).toBeTypeOf("string");
      expect(first.avg).toBeDefined();
      expect(
        first.avg.version === null || typeof first.avg.version === "string",
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
      expect(first.count.id).toBeTypeOf("string");
      expect(Number(first.count.id)).toBeGreaterThan(0);
      expect(first.avg).toBeDefined();
      expect(first.avg.version).toBeTypeOf("string");
      expect(Number(first.avg.version)).toBeGreaterThanOrEqual(1.0);
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
      expect(first.count.id).toBeTypeOf("string");
      expect(first.count.addresses).toBeDefined();
      expect(first.count.addresses.id).toBeTypeOf("string");
      expect(first.avg).toBeDefined();
      expect(first.avg.version).toBeTypeOf("string");
      expect(Number(first.avg.version)).toBeLessThan(100);
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
          typeof first.avg.addresses.country.version === "string",
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
        first.avg.version === null || typeof first.avg.version === "string",
      ).toBe(true);
      expect(first.avg.addresses).toBeDefined();
      expect(first.avg.addresses.country).toBeDefined();
      expect(
        first.avg.addresses.country.version === null ||
          typeof first.avg.addresses.country.version === "string",
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
    expect(first.count.id).toBe("0");
  });
});
