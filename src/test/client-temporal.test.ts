import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import { getTestClient } from "./client.utils";

describe("client temporal types tests", async () => {
  const client = await getTestClient();

  it("should handle Date field correctly", async () => {
    const expected = "2000-05-15";
    const testDate = new Date(expected);
    const contact = await client.contact.create({
      data: {
        firstName: "Alice",
        lastName: "Wonder",
        dateOfBirth: testDate,
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
    const testDate = new Date("1990-01-01");
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
});
