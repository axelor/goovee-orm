import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "./db/client";

describe("normalization data tests", async () => {
  const clientWithNormalization = createClient({
    features: {
      normalization: {
        lowerCase: true,
        unaccent: true,
      },
    },
  });

  const clientWithLowerCase = createClient({
    features: {
      normalization: {
        lowerCase: true,
      },
    },
  });

  const clientWithUnaccent = createClient({
    features: {
      normalization: {
        unaccent: true,
      },
    },
  });

  const clientWithoutNormalization = createClient({
    features: {
      normalization: {
        lowerCase: false,
        unaccent: false,
      },
    },
  });

  beforeAll(async () => {
    await clientWithNormalization.$connect();
    await clientWithLowerCase.$connect();
    await clientWithUnaccent.$connect();
    await clientWithoutNormalization.$connect();

    // Synchronize database schema to create tables
    await clientWithNormalization.$sync(true);

    // Create unaccent extension for PostgreSQL if it doesn't exist
    await clientWithNormalization.$raw(
      "CREATE EXTENSION IF NOT EXISTS unaccent",
    );
  });

  afterAll(async () => {
    await clientWithNormalization.$disconnect();
    await clientWithLowerCase.$disconnect();
    await clientWithUnaccent.$disconnect();
    await clientWithoutNormalization.$disconnect();
  });

  it("should find records using lowercase search with lowerCase normalization", async () => {
    // Create test data
    await clientWithoutNormalization.contact.create({
      data: {
        firstName: "John",
        lastName: "Smith",
        email: "john.smith@example.com",
      },
    });

    const results = await clientWithLowerCase.contact.find({
      select: {
        firstName: true,
        lastName: true,
      },
      where: {
        firstName: "john", // lowercase search
      },
    });

    expect(results).toHaveLength(1);
    expect(results[0].firstName).toBe("John");
    expect(results[0].lastName).toBe("Smith");
  });

  it("should find records using unaccented search with unaccent normalization", async () => {
    // Create test data
    await clientWithoutNormalization.contact.create({
      data: {
        firstName: "José",
        lastName: "González",
        email: "jose.gonzalez@example.com",
      },
    });

    const results = await clientWithUnaccent.contact.find({
      select: {
        firstName: true,
        lastName: true,
      },
      where: {
        firstName: "Jose", // unaccented search
      },
    });

    expect(results).toHaveLength(1);
    expect(results[0].firstName).toBe("José");
    expect(results[0].lastName).toBe("González");
  });

  it("should find records using both lowercase and unaccented search", async () => {
    // Create test data
    await clientWithoutNormalization.contact.create({
      data: {
        firstName: "José",
        lastName: "González",
        email: "jose.gonzalez@example.com",
      },
    });

    const results = await clientWithNormalization.contact.find({
      select: {
        firstName: true,
        lastName: true,
      },
      where: {
        firstName: "jose", // lowercase and unaccented search
      },
    });

    expect(results).toHaveLength(1);
    expect(results[0].firstName).toBe("José");
    expect(results[0].lastName).toBe("González");
  });

  it("should find records using LIKE with normalization", async () => {
    // Create test data
    await clientWithoutNormalization.contact.create({
      data: {
        firstName: "José",
        lastName: "González",
        email: "jose.gonzalez@example.com",
      },
    });

    const results = await clientWithNormalization.contact.find({
      select: {
        firstName: true,
        lastName: true,
      },
      where: {
        lastName: { like: "gonz%" }, // lowercase and unaccented partial match
      },
    });

    expect(results).toHaveLength(1);
    expect(results[0].firstName).toBe("José");
    expect(results[0].lastName).toBe("González");
  });

  it("should find records using IN with normalization", async () => {
    // Create test data
    await clientWithoutNormalization.contact.create({
      data: {
        firstName: "José",
        lastName: "González",
        email: "jose.gonzalez@example.com",
      },
    });
    await clientWithoutNormalization.contact.create({
      data: {
        firstName: "María",
        lastName: "Fernández",
        email: "maria.fernandez@example.com",
      },
    });

    const results = await clientWithNormalization.contact.find({
      select: {
        firstName: true,
      },
      where: {
        firstName: { in: ["jose", "maria"] }, // lowercase and unaccented list
      },
    });

    expect(results).toHaveLength(2);
    const names = results.map((r: any) => r.firstName).sort();
    expect(names).toEqual(["José", "María"]);

    // Clean up
    await clientWithoutNormalization.contact.deleteAll({});
  });

  it("should NOT find records without normalization for case-sensitive search", async () => {
    const results = await clientWithoutNormalization.contact.find({
      where: {
        firstName: "john", // lowercase search without normalization
      },
    });

    expect(results).toHaveLength(0); // Should not find "John" with lowercase "john"
  });

  it("should NOT find records without normalization for accent-sensitive search", async () => {
    const results = await clientWithoutNormalization.contact.find({
      where: {
        firstName: "Jose", // unaccented search without normalization
      },
    });

    expect(results).toHaveLength(0); // Should not find "José" with unaccented "Jose"
  });

  it("should work with complex queries and normalization", async () => {
    // Create test data
    await clientWithoutNormalization.contact.create({
      data: {
        firstName: "José",
        lastName: "González",
        email: "jose.gonzalez@example.com",
      },
    });
    await clientWithoutNormalization.contact.create({
      data: {
        firstName: "María",
        lastName: "Fernández",
        email: "maria.fernandez@example.com",
      },
    });
    await clientWithoutNormalization.contact.create({
      data: {
        firstName: "John",
        lastName: "Smith",
        email: "john.smith@example.com",
      },
    });

    const results = await clientWithNormalization.contact.find({
      where: {
        OR: [
          { firstName: { like: "jo%" } }, // should match both "José" and "John"
          { lastName: { like: "%ez" } }, // should match "González" and "Fernández"
        ],
      },
    });

    expect(results).toHaveLength(3); // All three records should match
  });

  it("should handle email normalization correctly", async () => {
    // Create test data
    await clientWithoutNormalization.contact.create({
      data: {
        firstName: "José",
        lastName: "González",
        email: "jose.gonzalez@example.com",
      },
    });

    const results = await clientWithNormalization.contact.find({
      select: {
        email: true,
      },
      where: {
        email: { like: "%GONZALEZ%" }, // uppercase search
      },
    });

    expect(results).toHaveLength(1);
    expect(results[0].email).toBe("jose.gonzalez@example.com");
  });

  it("should order records correctly with normalization", async () => {
    // Create test data with mixed case and accents
    await clientWithoutNormalization.contact.create({
      data: {
        firstName: "José",
        lastName: "González",
        email: "jose.gonzalez@example.com",
      },
    });
    await clientWithoutNormalization.contact.create({
      data: {
        firstName: "Ana",
        lastName: "Martínez",
        email: "ana.martinez@example.com",
      },
    });
    await clientWithoutNormalization.contact.create({
      data: {
        firstName: "carlos",
        lastName: "rodriguez",
        email: "carlos.rodriguez@example.com",
      },
    });

    // Order with normalization should be case and accent insensitive
    const results = await clientWithNormalization.contact.find({
      select: {
        firstName: true,
      },
      orderBy: {
        firstName: "ASC",
      },
    });

    expect(results).toHaveLength(3);
    // Expected order: Ana, carlos, José (normalized: ana, carlos, jose)
    expect(results[0].firstName).toBe("Ana");
    expect(results[1].firstName).toBe("carlos");
    expect(results[2].firstName).toBe("José");

    // Clean up
    await clientWithoutNormalization.contact.deleteAll({});
  });

  it("should not crash", async () => {
    await clientWithNormalization.contact.create({
      data: {
        firstName: "John",
        lastName: "Smith",
        email: "john.smith@example.com",
        bio: {
          create: {
            content: "It's Me!",
          },
        },
      },
    });

    const contact = await clientWithNormalization.contact.findOne({
      where: {
        bio: { content: "It's Me!" },
      },
      orderBy: { firstName: "ASC" },
      take: 10,
      select: {
        id: true,
      },
    });
    expect(contact).toBeDefined();
  });
});
