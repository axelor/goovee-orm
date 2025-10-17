import { describe, expect, it } from "vitest";
import { parseAggregate } from "../client/parser";
import { AggregateOptions } from "../client/types";
import { getTestClient } from "./client.utils";

import { Contact } from "./db/models";

describe("aggregate parser tests", async () => {
  const client = await getTestClient();

  // access the internal typeorm repo for testing
  const getContactRepo = () => (client.contact as any).unwrap();

  it("should parse simple count aggregation", () => {
    const opts: AggregateOptions<Contact> = {
      count: {
        id: true,
        firstName: true,
      },
    };

    const repo = getContactRepo();
    const res = parseAggregate(client, repo, opts);

    expect(res.select).toMatchObject({
      "COUNT(self.id)": "count_id",
      "COUNT(self.firstName)": "count_firstName",
    });
    expect(res.aliasMap).toMatchObject({
      count_id: "count.id",
      count_firstName: "count.firstName",
    });
  });

  it("should parse count with relations", () => {
    const opts: AggregateOptions<Contact> = {
      count: {
        title: {
          id: true,
        },
        addresses: {
          id: true,
        },
      },
    };

    const repo = getContactRepo();
    const res = parseAggregate(client, repo, opts);

    expect(res.select).toMatchObject({
      "COUNT(self_title.id)": "count_title_id",
      "COUNT(self_addresses.id)": "count_add_req67s",
    });
    expect(res.joins).toMatchObject({
      "self.title": "self_title",
      "self.addresses": "self_addresses",
    });
  });

  it("should parse count with where conditions", () => {
    const opts: AggregateOptions<Contact> = {
      count: {
        id: true,
      },
      where: {
        firstName: { like: "John%" },
        version: { gt: 0 },
      },
    };

    const repo = getContactRepo();
    const res = parseAggregate(client, repo, opts);

    expect(res.select).toMatchObject({
      "COUNT(self.id)": "count_id",
    });
    expect(res.where).toBe("self.firstName LIKE :p0 AND self.version > :p1");
    expect(res.params).toMatchObject({
      p0: "John%",
      p1: 0,
    });
  });

  it("should parse avg aggregation", () => {
    const opts: AggregateOptions<Contact> = {
      avg: {
        version: true,
      },
    };

    const repo = getContactRepo();
    const res = parseAggregate(client, repo, opts);

    expect(res.select).toMatchObject({
      "AVG(self.version)": "avg_version",
    });
  });

  it("should parse sum aggregation", () => {
    const opts: AggregateOptions<Contact> = {
      sum: {
        version: true,
      },
    };

    const repo = getContactRepo();
    const res = parseAggregate(client, repo, opts);

    expect(res.select).toMatchObject({
      "SUM(self.version)": "sum_version",
    });
  });

  it("should parse min and max aggregations", () => {
    const opts: AggregateOptions<Contact> = {
      min: {
        version: true,
        firstName: true,
      },
      max: {
        version: true,
        lastName: true,
      },
    };

    const repo = getContactRepo();
    const res = parseAggregate(client, repo, opts);

    expect(res.select).toMatchObject({
      "MIN(self.version)": "min_version",
      "MIN(self.firstName)": "min_firstName",
      "MAX(self.version)": "max_version",
      "MAX(self.lastName)": "max_lastName",
    });
  });

  it("should parse multiple aggregate operations together", () => {
    const opts: AggregateOptions<Contact> = {
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
    };

    const repo = getContactRepo();
    const res = parseAggregate(client, repo, opts);

    expect(res.select).toMatchObject({
      "COUNT(self.id)": "count_id",
      "AVG(self.version)": "avg_version",
      "SUM(self.version)": "sum_version",
      "MIN(self.firstName)": "min_firstName",
      "MAX(self.lastName)": "max_lastName",
    });
  });

  it("should parse simple groupBy fields", () => {
    const opts: AggregateOptions<Contact> = {
      count: {
        id: true,
      },
      groupBy: {
        firstName: true,
        version: true,
      },
    };

    const repo = getContactRepo();
    const res = parseAggregate(client, repo, opts);

    expect(res.select).toMatchObject({
      "COUNT(self.id)": "count_id",
      "self.firstName": "groupBy_f_ygirgy",
      "self.version": "groupBy_version",
    });
    expect(res.groups).toMatchObject({
      "self.firstName": "groupBy_f_ygirgy",
      "self.version": "groupBy_version",
    });
  });

  it("should parse groupBy with relations", () => {
    const opts: AggregateOptions<Contact> = {
      count: {
        id: true,
      },
      groupBy: {
        title: {
          id: true,
        },
      },
    };

    const repo = getContactRepo();
    const res = parseAggregate(client, repo, opts);

    expect(res.select).toMatchObject({
      "COUNT(self.id)": "count_id",
      "self_title.id": "groupBy_title_id",
    });
    expect(res.groups).toMatchObject({
      "self_title.id": "groupBy_title_id",
    });
    expect(res.joins).toMatchObject({
      "self.title": "self_title",
    });
  });

  it("should parse groupBy with nested relations", () => {
    const opts: AggregateOptions<Contact> = {
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
    };

    const repo = getContactRepo();
    const res = parseAggregate(client, repo, opts);

    expect(res.select).toMatchObject({
      "COUNT(self.id)": "count_id",
      "self_addresses_country.id": "groupBy_a_xtsb62",
    });
    expect(res.groups).toMatchObject({
      "self_addresses_country.id": "groupBy_a_xtsb62",
    });
    expect(res.joins).toMatchObject({
      "self.addresses": "self_addresses",
      "self_addresses.country": "self_addresses_country",
    });
  });

  it("should parse aggregates with groupBy and where conditions", () => {
    const opts: AggregateOptions<Contact> = {
      count: {
        id: true,
      },
      avg: {
        version: true,
      },
      groupBy: {
        firstName: true,
        title: {
          id: true,
        },
      },
      where: {
        version: { gt: 0 },
        lastName: { like: "Smith%" },
      },
    };

    const repo = getContactRepo();
    const res = parseAggregate(client, repo, opts);

    expect(res.select).toMatchObject({
      "COUNT(self.id)": "count_id",
      "AVG(self.version)": "avg_version",
      "self.firstName": "groupBy_f_ygirgy",
      "self_title.id": "groupBy_title_id",
    });
    expect(res.groups).toMatchObject({
      "self.firstName": "groupBy_f_ygirgy",
      "self_title.id": "groupBy_title_id",
    });
    expect(res.joins).toMatchObject({
      "self.title": "self_title",
    });
    expect(res.where).toBe("self.version > :p0 AND self.lastName LIKE :p1");
    expect(res.params).toMatchObject({
      p0: 0,
      p1: "Smith%",
    });
  });

  it("should parse having conditions", () => {
    const opts: AggregateOptions<Contact> = {
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
          id: { gt: 5 },
        },
        avg: {
          version: { ge: 2.0 },
        },
      },
    };

    const repo = getContactRepo();
    const res = parseAggregate(client, repo, opts);

    expect(res.select).toMatchObject({
      "COUNT(self.id)": "count_id",
      "AVG(self.version)": "avg_version",
      "self.firstName": "groupBy_f_ygirgy",
    });
    expect(res.groups).toMatchObject({
      "self.firstName": "groupBy_f_ygirgy",
    });
    expect(res.having).toBe(
      "COUNT(self.id) > :p0 AND AVG(self.version) >= :p1",
    );
    expect(res.params).toMatchObject({
      p0: 5,
      p1: 2.0,
    });
  });

  it("should parse having conditions with relations", () => {
    const opts: AggregateOptions<Contact> = {
      count: {
        title: {
          id: true,
        },
      },
      groupBy: {
        firstName: true,
      },
      having: {
        count: {
          title: {
            id: { ge: 2 },
          },
        },
      },
    };

    const repo = getContactRepo();
    const res = parseAggregate(client, repo, opts);

    expect(res.select).toMatchObject({
      "COUNT(self_title.id)": "count_title_id",
      "self.firstName": "groupBy_f_ygirgy",
    });
    expect(res.groups).toMatchObject({
      "self.firstName": "groupBy_f_ygirgy",
    });
    expect(res.joins).toMatchObject({
      "self.title": "self_title",
    });
    expect(res.having).toBe("COUNT(self_title.id) >= :p0");
    expect(res.params).toMatchObject({
      p0: 2,
    });
  });

  it("should parse complete aggregate query with all features", () => {
    const opts: AggregateOptions<Contact> = {
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
        count: {
          addresses: {
            id: { ge: 2 },
          },
        },
        avg: {
          version: { lt: 10 },
        },
      },
      take: 50,
      skip: 10,
    };

    const repo = getContactRepo();
    const res = parseAggregate(client, repo, opts);

    expect(res.select).toMatchObject({
      "COUNT(self.id)": "count_id",
      "COUNT(self_addresses.id)": "count_add_req67s",
      "AVG(self.version)": "avg_version",
      "MAX(self.firstName)": "max_firstName",
      "self.lastName": "groupBy_lastName",
      "self_title.id": "groupBy_title_id",
    });
    expect(res.groups).toMatchObject({
      "self.lastName": "groupBy_lastName",
      "self_title.id": "groupBy_title_id",
    });
    expect(res.joins).toMatchObject({
      "self.title": "self_title",
      "self.addresses": "self_addresses",
    });
    expect(res.where).toBe("self.version > :p0");
    expect(res.having).toBe(
      "COUNT(self_addresses.id) >= :p1 AND AVG(self.version) < :p2",
    );
    expect(res.take).toBe(50);
    expect(res.skip).toBe(10);
    expect(res.params).toMatchObject({
      p0: 0,
      p1: 2,
      p2: 10,
    });
    expect(res.aliasMap).toMatchObject({
      avg_version: "avg.version",
      max_firstName: "max.firstName",
      groupBy_lastName: "groupBy.lastName",
      groupBy_title_id: "groupBy.title.id",
    });
  });

  it("should parse nested aggregate with complex aliasMap", () => {
    const opts: AggregateOptions<Contact> = {
      avg: {
        addresses: {
          country: {
            version: true,
          },
        },
      },
    };

    const repo = getContactRepo();
    const res = parseAggregate(client, repo, opts);

    expect(res.select).toMatchObject({
      "AVG(self_addresses_country.version)": "avg_addre_mjs0ij",
    });
    expect(res.joins).toMatchObject({
      "self.addresses": "self_addresses",
      "self_addresses.country": "self_addresses_country",
    });
    expect(res.aliasMap).toMatchObject({
      avg_addre_mjs0ij: "avg.addresses.country.version",
    });
  });

  it("should handle duplicate field names with unique aliases", () => {
    const opts: AggregateOptions<Contact> = {
      avg: {
        version: true,
        addresses: {
          country: {
            version: true,
          },
        },
      },
    };

    const repo = getContactRepo();
    const res = parseAggregate(client, repo, opts);

    expect(res.select).toMatchObject({
      "AVG(self.version)": "avg_version",
      "AVG(self_addresses_country.version)": "avg_addre_mjs0ij",
    });
    expect(res.joins).toMatchObject({
      "self.addresses": "self_addresses",
      "self_addresses.country": "self_addresses_country",
    });
    expect(res.aliasMap).toMatchObject({
      avg_version: "avg.version",
      avg_addre_mjs0ij: "avg.addresses.country.version",
    });
  });
});
