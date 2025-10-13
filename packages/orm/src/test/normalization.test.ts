import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { QueryOptions } from "../client";
import { parseQuery } from "../client/parser";
import { createClient } from "./db/client";
import { Contact } from "./db/models";

describe("normalization feature tests", async () => {
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

  // access the internal typeorm repo for testing
  const getContactRepo = (client: any) => (client.contact as any).unwrap();

  describe("normalization parser tests", () => {
    it("should apply lowerCase normalization to string field queries", () => {
      const opts: QueryOptions<Contact> = {
        where: {
          firstName: "John",
          lastName: { like: "Smith" },
        },
      };

      const repo = getContactRepo(clientWithLowerCase);
      const res = parseQuery(clientWithLowerCase, repo, opts);

      expect(res.where).toContain("lower(self.firstName) = lower(:p0)");
      expect(res.where).toContain("lower(self.lastName) LIKE lower(:p1)");
      expect(res.params).toMatchObject({ p0: "John", p1: "Smith" });
    });

    it("should apply unaccent normalization to string field queries", () => {
      const opts: QueryOptions<Contact> = {
        where: {
          firstName: "José",
          lastName: { like: "González" },
        },
      };

      const repo = getContactRepo(clientWithUnaccent);
      const res = parseQuery(clientWithUnaccent, repo, opts);

      expect(res.where).toContain("unaccent(self.firstName) = unaccent(:p0)");
      expect(res.where).toContain("unaccent(self.lastName) LIKE unaccent(:p1)");
      expect(res.params).toMatchObject({ p0: "José", p1: "González" });
    });

    it("should apply both lowerCase and unaccent normalization", () => {
      const opts: QueryOptions<Contact> = {
        where: {
          firstName: "José",
          lastName: { like: "González" },
        },
      };

      const repo = getContactRepo(clientWithNormalization);
      const res = parseQuery(clientWithNormalization, repo, opts);

      expect(res.where).toContain(
        "unaccent(lower(self.firstName)) = unaccent(lower(:p0))",
      );
      expect(res.where).toContain(
        "unaccent(lower(self.lastName)) LIKE unaccent(lower(:p1))",
      );
      expect(res.params).toMatchObject({ p0: "José", p1: "González" });
    });

    it("should apply normalization to all string comparison operators", () => {
      const opts: QueryOptions<Contact> = {
        where: {
          firstName: { eq: "John" },
          lastName: { ne: "Smith" },
          email: { like: "%@example.com" },
          phone: { notLike: "+1%" },
        },
      };

      const repo = getContactRepo(clientWithNormalization);
      const res = parseQuery(clientWithNormalization, repo, opts);

      expect(res.where).toContain(
        "unaccent(lower(self.firstName)) = unaccent(lower(:p0))",
      );
      expect(res.where).toContain(
        "unaccent(lower(self.lastName)) != unaccent(lower(:p1))",
      );
      expect(res.where).toContain(
        "unaccent(lower(self.email)) LIKE unaccent(lower(:p2))",
      );
      expect(res.where).toContain(
        "unaccent(lower(self.phone)) NOT LIKE unaccent(lower(:p3))",
      );
    });

    it("should apply normalization to string fields in IN and NOT IN operations", () => {
      const opts: QueryOptions<Contact> = {
        where: {
          firstName: { in: ["John", "Jane", "José"] },
          lastName: { notIn: ["Smith", "González"] },
        },
      };

      const repo = getContactRepo(clientWithNormalization);
      const res = parseQuery(clientWithNormalization, repo, opts);

      expect(res.where).toContain(
        "unaccent(lower(self.firstName)) IN (unaccent(lower(:p0)), unaccent(lower(:p1)), unaccent(lower(:p2)))",
      );
      expect(res.where).toContain(
        "unaccent(lower(self.lastName)) NOT IN (unaccent(lower(:p3)), unaccent(lower(:p4)))",
      );
      expect(res.params).toMatchObject({
        p0: "John",
        p1: "Jane",
        p2: "José",
        p3: "Smith",
        p4: "González",
      });
    });

    it("should apply normalization to string fields in BETWEEN operations", () => {
      const opts: QueryOptions<Contact> = {
        where: {
          firstName: { between: ["A", "M"] },
          lastName: { notBetween: ["N", "Z"] },
        },
      };

      const repo = getContactRepo(clientWithNormalization);
      const res = parseQuery(clientWithNormalization, repo, opts);

      expect(res.where).toContain(
        "unaccent(lower(self.firstName)) BETWEEN unaccent(lower(:p0)) AND unaccent(lower(:p1))",
      );
      expect(res.where).toContain(
        "unaccent(lower(self.lastName)) NOT BETWEEN unaccent(lower(:p2)) AND unaccent(lower(:p3))",
      );
      expect(res.params).toMatchObject({
        p0: "A",
        p1: "M",
        p2: "N",
        p3: "Z",
      });
    });

    it("should not apply normalization to non-string fields", () => {
      const opts: QueryOptions<Contact> = {
        where: {
          id: 123,
          version: { gt: 1 },
        },
      };

      const repo = getContactRepo(clientWithNormalization);
      const res = parseQuery(clientWithNormalization, repo, opts);

      expect(res.where).toContain("self.id = :p0");
      expect(res.where).toContain("self.version > :p1");
      expect(res.where).not.toContain("lower(");
      expect(res.where).not.toContain("unaccent(");
    });

    it("should apply normalization to relational string field queries", () => {
      const opts: QueryOptions<Contact> = {
        where: {
          title: {
            name: "Mr.",
          },
          addresses: {
            city: { like: "París" },
            country: {
              name: "España",
            },
          },
        },
      };

      const repo = getContactRepo(clientWithNormalization);
      const res = parseQuery(clientWithNormalization, repo, opts);

      expect(res.where).toContain(
        "unaccent(lower(self_title.name)) = unaccent(lower(:p0))",
      );
      expect(res.where).toContain(
        "unaccent(lower(self_addresses.city)) LIKE unaccent(lower(:p1))",
      );
      expect(res.where).toContain(
        "unaccent(lower(self_addresses_country.name)) = unaccent(lower(:p2))",
      );
      expect(res.params).toMatchObject({
        p0: "Mr.",
        p1: "París",
        p2: "España",
      });
    });

    it("should handle complex logical queries with normalization", () => {
      const opts: QueryOptions<Contact> = {
        where: {
          firstName: "José",
          OR: [
            { lastName: { like: "González" } },
            { email: { like: "%josé%" } },
            {
              AND: [
                { firstName: { ne: "Juan" } },
                { lastName: { notLike: "García" } },
              ],
            },
          ],
        },
      };

      const repo = getContactRepo(clientWithNormalization);
      const res = parseQuery(clientWithNormalization, repo, opts);

      expect(res.where).toContain(
        "unaccent(lower(self.firstName)) = unaccent(lower(:p0))",
      );
      expect(res.where).toContain(
        "unaccent(lower(self.lastName)) LIKE unaccent(lower(:p1))",
      );
      expect(res.where).toContain(
        "unaccent(lower(self.email)) LIKE unaccent(lower(:p2))",
      );
      expect(res.where).toContain(
        "unaccent(lower(self.firstName)) != unaccent(lower(:p3))",
      );
      expect(res.where).toContain(
        "unaccent(lower(self.lastName)) NOT LIKE unaccent(lower(:p4))",
      );
      expect(res.params).toMatchObject({
        p0: "José",
        p1: "González",
        p2: "%josé%",
        p3: "Juan",
        p4: "García",
      });
    });

    it("should not apply normalization when feature is disabled", async () => {
      const opts: QueryOptions<Contact> = {
        where: {
          firstName: "José",
          lastName: { like: "González" },
        },
      };

      const repo = getContactRepo(clientWithoutNormalization);
      const res = parseQuery(clientWithoutNormalization, repo, opts);

      expect(res.where).toContain("self.firstName = :p0");
      expect(res.where).toContain("self.lastName LIKE :p1");
      expect(res.where).not.toContain("lower(");
      expect(res.where).not.toContain("unaccent(");
    });

    it("should apply normalization to orderBy string fields", () => {
      const opts: QueryOptions<Contact> = {
        orderBy: {
          firstName: "ASC",
          lastName: "DESC",
        },
      };

      const repo = getContactRepo(clientWithNormalization);
      const res = parseQuery(clientWithNormalization, repo, opts);

      expect(res.order).toMatchObject({
        "self_first_name_normalized": "ASC",
        "self_last_name_normalized": "DESC",
      });
    });

    it("should apply lowerCase normalization to orderBy string fields", () => {
      const opts: QueryOptions<Contact> = {
        orderBy: {
          firstName: "ASC",
          lastName: "DESC",
        },
      };

      const repo = getContactRepo(clientWithLowerCase);
      const res = parseQuery(clientWithLowerCase, repo, opts);

      expect(res.order).toMatchObject({
        "self_first_name_normalized": "ASC",
        "self_last_name_normalized": "DESC",
      });
    });

    it("should apply unaccent normalization to orderBy string fields", () => {
      const opts: QueryOptions<Contact> = {
        orderBy: {
          firstName: "ASC",
          lastName: "DESC",
        },
      };

      const repo = getContactRepo(clientWithUnaccent);
      const res = parseQuery(clientWithUnaccent, repo, opts);

      expect(res.order).toMatchObject({
        "self_first_name_normalized": "ASC",
        "self_last_name_normalized": "DESC",
      });
    });

    it("should not apply normalization to orderBy non-string fields", () => {
      const opts: QueryOptions<Contact> = {
        orderBy: {
          id: "ASC",
          version: "DESC",
        },
      };

      const repo = getContactRepo(clientWithNormalization);
      const res = parseQuery(clientWithNormalization, repo, opts);

      expect(res.order).toMatchObject({
        "self.id": "ASC",
        "self.version": "DESC",
      });
    });

    it("should not apply normalization to orderBy when feature is disabled", () => {
      const opts: QueryOptions<Contact> = {
        orderBy: {
          firstName: "ASC",
          lastName: "DESC",
        },
      };

      const repo = getContactRepo(clientWithoutNormalization);
      const res = parseQuery(clientWithoutNormalization, repo, opts);

      expect(res.order).toMatchObject({
        "self.firstName": "ASC",
        "self.lastName": "DESC",
      });
    });
  });

  describe("normalization data tests", () => {
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
