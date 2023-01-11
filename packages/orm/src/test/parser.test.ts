import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseQuery } from "../client/parser";
import { QueryOptions } from "../client/types";
import { createTestClient } from "./client.utils";

import { Contact } from "./entity";

describe("query parser tests1", async () => {
  const client = await createTestClient();
  beforeEach(async () => {
    await client.$connect();
    await client.$sync(true);
  });
  afterEach(async () => {
    await client.$disconnect();
  });

  // access the internal typeorm repo for testing
  const contact = (client.contact as any).unwrap();

  it("should parse simple `select` options", () => {
    const opts: QueryOptions<Contact> = {
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    };

    const res = parseQuery(contact, opts);
    expect(res.select).toMatchObject({
      "self.id": "self_id",
      "self.firstName": "self_first_name",
      "self.lastName": "self_last_name",
    });
  });

  it("should parse relational `select` options", () => {
    const opts: QueryOptions<Contact> = {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        title: {
          name: true,
        },
        addresses: {
          select: {
            street: true,
            city: true,
            country: {
              name: true,
            },
          },
        },
      },
    };

    const res = parseQuery(contact, opts);
    expect(res).toMatchObject({
      select: {
        "self.id": "self_id",
        "self.firstName": "self_first_name",
        "self.lastName": "self_last_name",
      },
      references: {
        title: {
          select: {
            "self.name": "self_name",
          },
        },
      },
      collections: {
        addresses: {
          select: {
            "self.street": "self_street",
            "self.city": "self_city",
          },
          references: {
            country: {
              select: {
                "self.name": "self_name",
              },
            },
          },
          mappedBy: "contact",
        },
      },
    });
  });

  it("should parse simple `where` options", () => {
    const opts: QueryOptions<Contact> = {
      where: {
        id: 1,
        firstName: "some",
      },
    };

    const res = parseQuery(contact, opts);
    expect(res).toMatchObject({
      where: "self.id = :p0 AND self.firstName = :p1",
      params: { p0: 1, p1: "some" },
    });
  });

  it("should parse simple `where` options with operators", () => {
    const opts: QueryOptions<Contact> = {
      where: {
        id: { ne: 1 },
        firstName: { like: "some" },
      },
    };

    const res = parseQuery(contact, opts);
    expect(res).toMatchObject({
      where: "NOT(self.id = :p0) AND self.firstName LIKE :p1",
      params: { p0: 1, p1: "some" },
    });
  });

  it("should parse `where` options with logical operators", () => {
    const opts: QueryOptions<Contact> = {
      where: {
        id: { eq: 1 },
        firstName: { like: "some" },
        OR: [
          { firstName: { like: "thing" } },
          { lastName: { like: "else" } },
          {
            AND: [
              { version: { gt: 1 } },
              { id: { ne: 1 } },
              {
                NOT: [{ version: null }, { id: 1 }],
              },
            ],
          },
        ],
      },
    };

    const res = parseQuery(contact, opts);
    expect(res).toMatchObject({
      where:
        "self.id = :p0 AND self.firstName LIKE :p1 AND (self.firstName LIKE :p2 OR self.lastName LIKE :p3 OR (self.version > :p4 AND NOT(self.id = :p5) AND NOT(self.version = :p6 AND self.id = :p7)))",
      params: {
        p0: 1,
        p1: "some",
        p2: "thing",
        p3: "else",
        p4: 1,
        p5: 1,
        p6: null,
        p7: 1,
      },
    });
  });

  it("should parse `where` options with joined filters", () => {
    const opts: QueryOptions<Contact> = {
      where: {
        title: {
          name: "Mr.",
        },
        addresses: {
          city: "Paris",
          country: {
            code: "fr",
          },
        },
      },
    };
    const res = parseQuery(contact, opts);
    expect(res).toMatchObject({
      joins: {
        "self.title": "self_title",
        "self_addresses.country": "self_addresses_country",
        "self.addresses": "self_addresses",
      },
      where:
        "self_title.name = :p0 AND self_addresses.city = :p1 AND self_addresses_country.code = :p2",
      params: {
        p0: "Mr.",
        p1: "Paris",
        p2: "fr",
      },
    });
  });
});
