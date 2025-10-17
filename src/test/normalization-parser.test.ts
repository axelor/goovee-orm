import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { QueryOptions } from "../client";
import { parseQuery } from "../client/parser";
import { createClient } from "./db/client";
import { Contact } from "./db/models";

describe("normalization parser tests", async () => {
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
      self_first_name_normalized: "ASC",
      self_last_name_normalized: "DESC",
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
      self_first_name_normalized: "ASC",
      self_last_name_normalized: "DESC",
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
      self_first_name_normalized: "ASC",
      self_last_name_normalized: "DESC",
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
