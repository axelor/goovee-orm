import { describe, expect, it } from "vitest";
import { parseQuery } from "../client/parser";
import { QueryOptions } from "../client/types";
import { getTestClient } from "./client.utils";

import { Contact } from "./db/models";

describe("query parser tests", async () => {
  const client = await getTestClient();

  // access the internal typeorm repo for testing
  const getContactRepo = () => (client.contact as any).unwrap();

  it("should parse simple `select` options", () => {
    const opts: QueryOptions<Contact> = {
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    };

    const repo = getContactRepo();
    const res = parseQuery(repo, opts);
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

    const repo = getContactRepo();
    const res = parseQuery(repo, opts);
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
        },
      },
    });
  });

  it("should select all simmple fields by default", async () => {
    const repo = getContactRepo();
    let opts: QueryOptions<Contact> = {};
    let res = parseQuery(repo, opts);

    expect(res.select).toBeDefined();
    expect(res.select).toHaveProperty("self.id");
    expect(res.select).toHaveProperty("self.fullName");
    expect(res.select).not.toHaveProperty("self.image");
    expect(res.select).not.toHaveProperty("self.attrs");

    opts = { select: { title: true } };
    res = parseQuery(repo, opts);

    expect(res).toMatchObject({
      select: {
        "self_title.id": "self_title_id",
        "self_title.version": "self_title_version",
        "self_title.code": "self_title_code",
        "self_title.name": "self_title_name",
      },
      joins: {
        "self.title": "self_title",
      },
    });

    opts = { select: { addresses: true } };
    res = parseQuery(repo, opts);

    expect(res).toMatchObject({
      collections: {
        addresses: {
          select: {
            "self.id": "self_id",
            "self.version": "self_version",
            "self.type": "self_type",
            "self.street": "self_street",
            "self.area": "self_area",
            "self.city": "self_city",
            "self.zip": "self_zip",
            "self.state": "self_state",
          },
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

    const repo = getContactRepo();
    const res = parseQuery(repo, opts);
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

    const repo = getContactRepo();
    const res = parseQuery(repo, opts);
    expect(res).toMatchObject({
      where: "self.id != :p0 AND self.firstName LIKE :p1",
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
                NOT: [{ version: 1 }, { id: 1 }],
              },
            ],
          },
        ],
      },
    };

    const repo = getContactRepo();
    const res = parseQuery(repo, opts);
    expect(res).toMatchObject({
      where:
        "self.id = :p0 AND self.firstName LIKE :p1 AND (self.firstName LIKE :p2 OR self.lastName LIKE :p3 OR (self.version > :p4 AND self.id != :p5 AND NOT(self.version = :p6 AND self.id = :p7)))",
      params: {
        p0: 1,
        p1: "some",
        p2: "thing",
        p3: "else",
        p4: 1,
        p5: 1,
        p6: 1,
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
    const repo = getContactRepo();
    const res = parseQuery(repo, opts);
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

  it("should handle `in, notIn, like, notLike, between, notBetween`", () => {
    const opts: QueryOptions<Contact> = {
      where: {
        id: {
          in: [1, 2, 3],
        },
        version: {
          notIn: [-1, 0],
        },
        firstName: {
          like: "some",
        },
        lastName: {
          notLike: "some",
        },
        OR: [
          {
            id: {
              between: [10, 20],
            },
          },
          {
            version: {
              notBetween: [10, 20],
            },
          },
        ],
      },
    };
    const repo = getContactRepo();
    const res = parseQuery(repo, opts);
    expect(res).toMatchObject({
      where:
        "self.id IN (:...p0) AND self.version NOT IN (:...p1) AND self.firstName LIKE :p2 AND self.lastName NOT LIKE :p3 AND (self.id BETWEEN :p4 AND :p5 OR self.version NOT BETWEEN :p6 AND :p7)",
      params: {
        p0: [1, 2, 3],
        p1: [-1, 0],
        p2: "some",
        p3: "some",
        p4: 10,
        p5: 20,
        p6: 10,
        p7: 20,
      },
    });
  });

  it("should parse IS NULL & NOT NULL", async () => {
    const opts: QueryOptions<Contact> = {
      where: {
        version: {
          eq: null,
        },
        email: null,
        phone: {
          ne: null,
        },
        title: {
          id: null,
        },
        bio: {
          id: {
            ne: null,
          },
        },
      },
    };
    const repo = getContactRepo();
    const res = parseQuery(repo, opts);
    expect(res).toMatchObject({
      where:
        "self.version IS NULL AND self.email IS NULL AND self.phone NOT NULL AND self.title IS NULL AND self.bio NOT NULL",
    });
  });

  it("should parse orderBy", async () => {
    const opts: QueryOptions<Contact> = {
      select: {
        addresses: {
          orderBy: {
            city: "ASC",
            contact: {
              firstName: "DESC",
            },
          },
        },
      },
      orderBy: {
        firstName: "DESC",
        title: {
          name: "ASC",
        },
        addresses: {
          country: {
            code: "DESC",
          },
        },
      },
    };
    const repo = getContactRepo();
    const res = parseQuery(repo, opts);

    expect(res).toMatchObject({
      joins: {
        "self.addresses": "self_addresses",
        "self.title": "self_title",
        "self_addresses.country": "self_addresses_country",
      },
      order: {
        "self.firstName": "DESC",
        "self_title.name": "ASC",
        "self_addresses_country.code": "DESC",
      },
      collections: {
        addresses: {
          joins: {
            "self.contact": "self_contact",
          },
          order: {
            "self.city": "ASC",
            "self_contact.firstName": "DESC",
          },
        },
      },
    });
  });

  it("should parse json where expressions", async () => {
    const opts: QueryOptions<Contact> = {
      where: {
        attrs: {
          "name::text": {
            eq: "some",
          },
        },
        bio: {
          me: {
            "some::integer": {
              in: [1, 2, 3],
            },
          },
        },
        addresses: {
          props: {
            "some::timestamp": {
              between: ["2022-01-01T00:00:00.000Z", "2023-01-01T00:00:00.000Z"],
            },
          },
        },
      },
    };

    const repo = getContactRepo();
    const res = parseQuery(repo, opts);

    expect(res).toMatchObject({
      joins: {
        "self.bio": "self_bio",
        "self.addresses": "self_addresses",
      },
      where:
        "jsonb_path_exists(self.attrs, '$.name ? (@ == $p0)', jsonb_build_object('p0', cast(:p0 as text))) AND jsonb_path_exists(self_bio.me, '$.some ? (@ == $p1 || @ == $p2 || @ == $p3)', jsonb_build_object('p1', cast(:p1 as integer), 'p2', cast(:p2 as integer), 'p3', cast(:p3 as integer))) AND jsonb_path_exists(self_addresses.props, '$.some ? (@ >= $p4 && @ <= $p5)', jsonb_build_object('p4', cast(:p4 as timestamp), 'p5', cast(:p5 as timestamp)))",
      params: {
        p0: "some",
        p1: 1,
        p2: 2,
        p3: 3,
        p4: "2022-01-01T00:00:00.000Z",
        p5: "2023-01-01T00:00:00.000Z",
      },
    });
  });

  it("should parse json orderBy expressions", async () => {
    const opts: QueryOptions<Contact> = {
      orderBy: {
        attrs: {
          "name::text": "DESC",
        },
        bio: {
          me: {
            "skill::text": "DESC",
          },
        },
      },
    };

    const repo = getContactRepo();
    const res = parseQuery(repo, opts);

    expect(res).toMatchObject({
      joins: { "self.bio": "self_bio" },
      order: {
        "cast(jsonb_extract_path_text(self.attrs, 'name') as text)": "DESC",
        "cast(jsonb_extract_path_text(self_bio.me, 'skill') as text)": "DESC",
      },
    });
  });
});
