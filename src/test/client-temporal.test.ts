import { beforeEach, describe, expect, it } from "vitest";
import { getTestClient } from "./client.utils";

describe("client temporal types tests", async () => {
  const client = await getTestClient();

  it("should handle Date field correctly", async () => {
    const expected = "2000-05-15";
    const contact = await client.contact.create({
      data: {
        firstName: "Alice",
        lastName: "Wonder",
        dateOfBirth: expected,
      },
      select: {
        dateOfBirth: true,
      },
    });
    expect(contact.dateOfBirth).toBeDefined();
    expect(typeof contact.dateOfBirth).toBe("string");
    expect(contact.dateOfBirth).toBe(expected);
  });

  it("should handle Time field correctly", async () => {
    const expected = "14:30:45";
    const contact = await client.contact.create({
      data: {
        firstName: "Bob",
        lastName: "Builder",
        timeOfBirth: expected,
      },
      select: {
        timeOfBirth: true,
      },
    });

    expect(contact.timeOfBirth).toBeDefined();
    expect(typeof contact.timeOfBirth).toBe("string");
    expect(contact.timeOfBirth).toBe(expected);
  });

  it("should handle DateTime field correctly", async () => {
    const expected = new Date();
    const contact = await client.contact.create({
      data: {
        firstName: "Charlie",
        lastName: "Chaplin",
        registeredOn: expected,
      },
      select: {
        registeredOn: true,
      },
    });
    expect(contact.registeredOn).toBeDefined();
    expect(contact.registeredOn).toBeInstanceOf(Date);
    expect(contact.registeredOn).toEqual(expected);
  });

  it("should filter by Date field correctly", async () => {
    const testDate = "1990-01-01";
    const contact = await client.contact.create({
      data: {
        firstName: "Diana",
        lastName: "Prince",
        dateOfBirth: testDate,
      },
      select: {
        id: true,
      },
    });

    const result = await client.contact.find({
      where: {
        dateOfBirth: {
          eq: testDate,
        },
      },
      select: {
        id: true,
        dateOfBirth: true,
      },
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].dateOfBirth).toBe("1990-01-01");
  });

  describe("DateTime comparison operators (hour-level differences)", () => {
    const now = new Date();
    const past = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago
    const future = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour from now

    beforeEach(async () => {
      await client.contact.create({
        data: { firstName: "DT", lastName: "Ops", registeredOn: now },
        select: { id: true, registeredOn: true },
      });
    });

    const findByDate = (registeredOn: object) =>
      client.contact.find({
        where: { registeredOn },
        select: { id: true },
      });

    it("eq", async () => {
      expect(await findByDate({ eq: now })).toHaveLength(1);
      expect(await findByDate({ eq: future })).toHaveLength(0);
    });

    it("ne", async () => {
      expect(await findByDate({ ne: future })).toHaveLength(1);
      expect(await findByDate({ ne: now })).toHaveLength(0);
    });

    it("gt", async () => {
      expect(await findByDate({ gt: past })).toHaveLength(1);
      expect(await findByDate({ gt: future })).toHaveLength(0);
      expect(await findByDate({ gt: now })).toHaveLength(0);
    });

    it("ge", async () => {
      expect(await findByDate({ ge: now })).toHaveLength(1);
      expect(await findByDate({ ge: future })).toHaveLength(0);
      expect(await findByDate({ ge: past })).toHaveLength(1);
    });

    it("lt", async () => {
      expect(await findByDate({ lt: future })).toHaveLength(1);
      expect(await findByDate({ lt: past })).toHaveLength(0);
      expect(await findByDate({ lt: now })).toHaveLength(0);
    });

    it("le", async () => {
      expect(await findByDate({ le: now })).toHaveLength(1);
      expect(await findByDate({ le: past })).toHaveLength(0);
      expect(await findByDate({ le: future })).toHaveLength(1);
    });

    it("in", async () => {
      expect(await findByDate({ in: [past, now, future] })).toHaveLength(1);
      expect(await findByDate({ in: [past, future] })).toHaveLength(0);
    });

    it("notIn", async () => {
      expect(await findByDate({ notIn: [past, future] })).toHaveLength(1);
      expect(await findByDate({ notIn: [past, now, future] })).toHaveLength(0);
    });

    it("between", async () => {
      expect(await findByDate({ between: [past, future] })).toHaveLength(1);
      expect(await findByDate({ between: [future, future] })).toHaveLength(0);
      expect(await findByDate({ between: [now, now] })).toHaveLength(1);
      expect(await findByDate({ between: [past, now] })).toHaveLength(1);
      expect(await findByDate({ between: [now, future] })).toHaveLength(1);
    });

    it("notBetween", async () => {
      expect(await findByDate({ notBetween: [future, future] })).toHaveLength(
        1,
      );
      expect(await findByDate({ notBetween: [past, future] })).toHaveLength(0);
      expect(await findByDate({ notBetween: [now, now] })).toHaveLength(0);
      expect(await findByDate({ notBetween: [past, now] })).toHaveLength(0);
      expect(await findByDate({ notBetween: [now, future] })).toHaveLength(0);
    });
  });
});
