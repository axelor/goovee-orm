import { describe, expect, it } from "vitest";
import { getTestClient } from "./client.utils";
import { BigDecimal } from "@goovee/orm";
import { AddressType } from "./db/models";

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

  it("should include the null group as its own bucket for nullable columns", async () => {
    await client.country.createAll({
      data: [
        { code: "nb1", name: "Null Bucket One" },
        { code: "nb2", name: "Null Bucket Two" },
        { code: "nb3", name: "Null Bucket Three", population: "5" },
      ],
    });

    const groups = await client.country.aggregate({
      groupBy: { population: true },
      count: { id: true },
      where: { code: { in: ["nb1", "nb2", "nb3"] } },
    });

    const nullBucket = groups.find((g) => g.groupBy.population === null);
    const fiveBucket = groups.find((g) =>
      g.groupBy.population?.equals(new BigDecimal("5")),
    );

    expect(nullBucket?.count.id).toBe("2");
    expect(fiveBucket?.count.id).toBe("1");
  });

  it("should aggregate empty sets to null and count zero", async () => {
    const result = await client.country.aggregate({
      count: { id: true },
      sum: { population: true },
      avg: { population: true },
      min: { population: true },
      max: { name: true },
      where: { code: { in: ["does-not-exist"] } },
    });

    expect(result[0].count.id).toBe("0");
    expect(result[0].sum.population).toBeNull();
    expect(result[0].avg.population).toBeNull();
    expect(result[0].min.population).toBeNull();
    expect(result[0].max.name).toBeNull();

    const groups = await client.country.aggregate({
      groupBy: { population: true },
      count: { id: true },
      where: { code: { in: ["does-not-exist"] } },
    });

    expect(groups).toHaveLength(0);
  });

  it("should group by boolean and enum columns", async () => {
    await client.country.createAll({
      data: [
        { code: "bool1", name: "Bool One", isMember: true },
        { code: "bool2", name: "Bool Two", isMember: true },
        { code: "bool3", name: "Bool Three", isMember: false },
      ],
    });

    const bools = await client.country.aggregate({
      groupBy: { isMember: true },
      count: { id: true },
      where: { code: { in: ["bool1", "bool2", "bool3"] } },
    });

    expect(bools.find((g) => g.groupBy.isMember === true)?.count.id).toBe("2");
    expect(bools.find((g) => g.groupBy.isMember === false)?.count.id).toBe("1");

    await client.contact.create({
      data: {
        firstName: "E",
        lastName: "Enum",
        addresses: {
          create: [
            { street: "A", type: AddressType.Office },
            { street: "B", type: AddressType.Office },
          ],
        },
      },
    });

    const enums = await client.address.aggregate({
      groupBy: { type: true },
      count: { id: true },
      where: { type: { in: [AddressType.Office] } },
    });

    expect(enums[0].groupBy.type).toBe(AddressType.Office);
  });

  it("should group by columns reached through relations", async () => {
    const title = await client.title.create({
      data: { code: "rw", name: "RW Title" },
    });
    await client.contact.createAll({
      data: [
        {
          firstName: "R1",
          lastName: "RelWalk",
          title: { select: { id: title.id } },
        },
        {
          firstName: "R2",
          lastName: "RelWalk",
          title: { select: { id: title.id } },
        },
      ],
    });

    const groups = await client.contact.aggregate({
      groupBy: { title: { name: true } },
      count: { id: true },
      where: { lastName: { in: ["RelWalk"] } },
    });

    expect(groups[0].groupBy.title.name).toBe("RW Title");
    expect(groups[0].count.id).toBe("2");
  });

  it("should sum and average integer columns as exact strings", async () => {
    await client.country.createAll({
      data: [
        { code: "int1", name: "Int One", rank: 1 },
        { code: "int2", name: "Int Two", rank: 2 },
      ],
    });

    const result = await client.country.aggregate({
      sum: { rank: true },
      avg: { rank: true },
      min: { rank: true },
      max: { rank: true },
      where: { code: { in: ["int1", "int2"] } },
    });

    expect(result[0].sum.rank).toBe("3");
    expect(Number(result[0].avg.rank)).toBe(1.5);
    expect(result[0].min.rank).toBe(1);
    expect(result[0].max.rank).toBe(2);

    const groups = await client.country.aggregate({
      groupBy: { rank: true },
      count: { id: true },
      where: { code: { in: ["int1", "int2"] } },
    });
    const keys = groups.map((g) => g.groupBy.rank).sort();

    expect(keys).toEqual([1, 2]);
  });

  it("should min/max time columns as strings", async () => {
    await client.contact.createAll({
      data: [
        { firstName: "TM1", lastName: "TimeMinMax", timeOfBirth: "09:15:00" },
        { firstName: "TM2", lastName: "TimeMinMax", timeOfBirth: "14:30:45" },
      ],
    });

    const result = await client.contact.aggregate({
      min: { timeOfBirth: true },
      max: { timeOfBirth: true },
      where: { lastName: { in: ["TimeMinMax"] } },
    });

    expect(result[0].min.timeOfBirth).toBe("09:15:00");
    expect(result[0].max.timeOfBirth).toBe("14:30:45");
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
