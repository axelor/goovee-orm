// Type-level tests for the ORM client API. Run: `pnpm test:types`
// POSITIVE cases must compile (regression surface). NEGATIVE cases use
// single-line `@ts-expect-error` — keep them one line so the directive
// attaches to the reported error. No DB needed; client is `declare`d.
import { describe, expectTypeOf, test } from "vitest";

import type { Contact, Country } from "./db/models";
import { AddressType } from "./db/models";
import type { BigDecimal, Payload, SelectOptions, WhereOptions } from "@goovee/orm";
import type { TestClient } from "./client.utils";

declare const client: TestClient;
declare const big: BigDecimal;
const { contact, country, address } = client;

// ===========================================================================
// POSITIVE — valid usage that MUST keep compiling (the regression surface)
// ===========================================================================

describe("valid: where filters", () => {
  test("operators + shorthand + null", () => {
    contact.findOne({ where: { firstName: { eq: "a" }, lastName: { like: "A%", notLike: "Z%" } } });
    contact.findOne({ where: { firstName: "a", email: { ne: null } } });
    contact.findOne({ where: { email: null } });
    contact.findOne({ where: { id: { in: [1, "2", 3], notIn: [9] } } });
    contact.findOne({ where: { registeredOn: { between: [new Date(), new Date()], gt: new Date() } } });
    contact.findOne({ where: { registeredOn: { notBetween: [new Date(), new Date()] } } });
    contact.findOne({ where: { dateOfBirth: { ge: "2000-01-01", le: "2020-12-31" } } });
    contact.findOne({ where: { firstName: { notIn: ["a", "b"] } } });
    country.findOne({ where: { isMember: true } });
    country.findOne({ where: { isMember: { eq: false, ne: null } } });
    country.findOne({ where: { population: { gt: 1000 } } });
    country.findOne({ where: { population: { gt: "1000", le: 5000n, between: [0, 9] } } });
    country.findOne({ where: { population: { notBetween: ["0", "100"] } } });
    country.findOne({ where: { population: 42 } });
  });

  test("decimal accepts all four representations: string, number, bigint, BigDecimal", () => {
    country.findOne({ where: { population: { eq: big, ge: big } } });
    country.findOne({ where: { population: big } });
    country.findOne({ where: { population: { in: [1, "2", 3n, big] } } });
    country.findOne({ where: { population: { between: [big, big] } } });
  });

  test("datetime filter accepts Date objects and strings", () => {
    contact.findOne({ where: { registeredOn: { gt: "2020-01-01", lt: new Date() } } });
    contact.findOne({ where: { registeredOn: { between: ["2020-01-01", "2021-01-01"] } } });
    contact.findOne({ where: { registeredOn: { in: [new Date(), "2020-01-01"] } } });
  });

  test("date and time fields filter as strings", () => {
    contact.findOne({ where: { timeOfBirth: { like: "12:%" } } });
    contact.findOne({ where: { dateOfBirth: { between: ["1990-01-01", "2000-12-31"], notIn: ["1995-06-15"] } } });
  });

  test("int field accepts numbers", () => {
    country.findOne({ where: { rank: { gt: 1, between: [1, 10], in: [1, 2] } } });
    country.findOne({ where: { rank: 2 } });
    country.findOne({ where: { rank: null } });
  });

  test("nested relation filters", () => {
    contact.findOne({ where: { title: { name: { eq: "Mr" } } } });
    contact.findOne({ where: { addresses: { city: { like: "%NY%" } } } });
    contact.findOne({ where: { addresses: { country: { code: "US", isMember: true } } } });
    contact.findOne({ where: { addresses: { tags: { name: { ne: null } } } } });
    contact.findOne({ where: { circles: { contacts: { firstName: "x" } } } });
    contact.findOne({ where: { bio: { content: { like: "%hi%" } } } });
  });

  test("OR / AND / NOT, mixed, deeply nested", () => {
    contact.findOne({ where: { OR: [{ firstName: "a" }, { lastName: "b" }] } });
    contact.findOne({ where: { AND: [{ firstName: "a" }, { NOT: [{ email: null }] }] } });
    contact.findOne({ where: { firstName: { like: "a%" }, OR: [{ email: { ne: null } }, { phone: { ne: null } }] } });
    contact.findOne({ where: { OR: [{ email: null }, { AND: [{ firstName: "a" }, { OR: [{ phone: "1" }, { phone: "2" }] }] }] } });
    contact.findOne({ where: { title: { name: "Mr" }, AND: [{ addresses: { city: "NY" } }] } });
  });

  test("JSON field filters", () => {
    contact.findOne({ where: { attrs: { path: "level", type: "Int", eq: 3 } } });
    contact.findOne({ where: { attrs: { path: "name", type: "String", like: "Jo%" } } });
    contact.findOne({ where: { attrs: { path: "active", type: "Boolean", eq: true } } });
    contact.findOne({ where: { attrs: { path: "score", type: "Decimal", gt: "1.5", le: 100 } } });
    contact.findOne({ where: { attrs: { path: "joined", type: "Date", gt: "2020-01-01", lt: new Date() } } });
  });

  test("enum field and IdFilter", () => {
    address.findOne({ where: { type: AddressType.Home } });
    address.findOne({ where: { type: { eq: AddressType.Office, ne: null } } });
    address.findOne({ where: { type: null } });
    contact.findOne({ where: { id: { eq: "1" } } });
    contact.findOne({ where: { id: { in: [1, 2, "3"], notIn: [99] } } });
    contact.findOne({ where: { id: { ne: null } } });
  });
});

describe("valid: select / orderBy / pagination", () => {
  test("scalar / to-one / to-many / OneToOne / deep", () => {
    contact.findOne({ select: { firstName: true, lastName: true } });
    contact.findOne({ select: { title: { name: true, code: true } } });
    contact.findOne({ select: { bio: { content: true } } });
    contact.findOne({ select: { addresses: { select: { street: true, city: true } } } });
    contact.findOne({
      select: {
        firstName: true,
        title: { name: true },
        bio: { content: true },
        addresses: {
          where: { city: { ne: null } },
          orderBy: { street: "ASC" },
          take: 5,
          skip: 1,
          distinct: true,
          select: { street: true, country: { code: true, name: true }, tags: { select: { name: true } } },
        },
        circles: { select: { code: true, contacts: { select: { firstName: true } } } },
      },
    });
  });

  test("lazy + json field selection (input side)", () => {
    contact.findOne({ select: { attrs: true, notes: true } });
    address.findOne({ select: { props: true, street: true } });
  });

  test("orderBy simple / nested / JSON + pagination", () => {
    contact.find({ orderBy: { firstName: "ASC", lastName: "DESC" } });
    contact.find({ orderBy: { title: { name: "DESC" } } });
    contact.find({ orderBy: { attrs: [{ path: "rank", type: "Int", order: "DESC" }] } });
    contact.find({ orderBy: { attrs: [{ path: "joined", type: "Date", order: "ASC" }, { path: "score", type: "Decimal", order: "DESC" }, { path: "active", type: "Boolean", order: "ASC" }] } });
    contact.find({ orderBy: { registeredOn: "DESC", dateOfBirth: "ASC", timeOfBirth: "ASC" } });
    country.find({ orderBy: { rank: "ASC", population: "DESC" } });
    contact.find({ take: 10, skip: 5, distinct: true, cursor: "abc" });
  });
});

describe("valid: aggregate", () => {
  test("avg/sum/min/max/count/groupBy + having/orderBy/where", () => {
    country.aggregate({ avg: { population: true } });
    country.aggregate({ sum: { population: true }, count: { id: true } });
    country.aggregate({ groupBy: { isMember: true }, count: { code: true }, having: { count: { code: { gt: 1 } } } });
    country.aggregate({ min: { name: true }, max: { name: true }, where: { isMember: true } });
    country.aggregate({ groupBy: { isMember: true }, orderBy: { count: { code: "DESC" } }, take: 10, skip: 0 });
  });

  test("all operations combined and nested-relation count", () => {
    country.aggregate({
      avg: { population: true },
      sum: { population: true },
      min: { name: true },
      max: { name: true },
      count: { id: true },
      groupBy: { isMember: true },
    });
    contact.aggregate({ count: { addresses: { street: true } } });
  });
});

describe("valid: mutations", () => {
  test("create: scalars / link / nested create / bigdecimal", () => {
    contact.create({ data: { firstName: "a", lastName: "b" } });
    contact.create({ data: { firstName: "a", lastName: "b", title: { select: { id: 1 } } } });
    contact.create({ data: { firstName: "a", lastName: "b", title: { create: { code: "MR", name: "Mr" } } } });
    contact.create({ data: { firstName: "a", lastName: "b", addresses: { create: [{ street: "1 Main", city: "NY", contact: { select: { id: 1 } } }] }, circles: { select: [{ code: "x" }] } } });
    address.create({ data: { street: "Main St", contact: { select: { id: "1" } } } });
    country.create({ data: { code: "US", name: "USA", population: "1000.5" } });
    country.create({ data: { code: "IN", name: "India", population: 200n } });
    country.create({ data: { code: "FR", name: "France", population: 67.5 }, select: { code: true } });
    country.create({ data: { code: "DE", name: "Germany", population: big, rank: 5 } });
  });

  test("create/update: temporal, enum, json and int inputs", () => {
    contact.create({ data: { firstName: "a", lastName: "b", registeredOn: new Date(), dateOfBirth: "2000-05-15", timeOfBirth: "14:30:45", attrs: Promise.resolve({ level: 3 }) } });
    address.create({ data: { street: "s", contact: { select: { id: 1 } }, type: AddressType.Office } });
    contact.update({ data: { id: "1", version: 0, registeredOn: new Date(), dateOfBirth: null, attrs: null } });
    address.update({ data: { id: "1", version: 0, type: null } });
    country.update({ data: { id: "1", version: 0, rank: 3 } });
    country.update({ data: { id: "1", version: 0, rank: null } });
  });

  test("decimal create/update/set accept all four representations", () => {
    country.update({ data: { id: "1", version: 0, population: 7n } });
    country.update({ data: { id: "1", version: 0, population: 1.5 } });
    country.update({ data: { id: "1", version: 0, population: big } });
    country.updateAll({ set: { population: big } });
    country.updateAll({ set: { population: 5n } });
    country.updateAll({ set: { population: 2.5 } });
    country.createAll({ data: [{ code: "X", name: "X", population: big }] });
  });

  test("nested create auto-fills the required mappedBy field, so it must be omittable", () => {
    contact.create({ data: { firstName: "a", lastName: "b", addresses: { create: [{ street: "x" }] } } });
    contact.update({ data: { id: "1", version: 0, addresses: { create: [{ street: "x" }] } } });
  });

  test("nested create only relaxes the mappedBy field, nothing else", () => {
    // @ts-expect-error unbranded (ManyToMany) nested creates keep all required fields
    contact.create({ data: { firstName: "a", lastName: "b", circles: { create: [{}] } } });
    // @ts-expect-error update path: unbranded nested creates keep all required fields
    contact.update({ data: { id: "1", version: 0, circles: { create: [{}] } } });
  });

  test("OneToOne create / update / unlink (bio)", () => {
    contact.create({ data: { firstName: "a", lastName: "b", bio: { create: { content: "hello" } } } });
    contact.update({ data: { id: "1", version: 0, bio: { create: { content: "updated" } } } });
    contact.update({ data: { id: "1", version: 0, bio: { select: { id: null } } } });
  });

  test("unlink ManyToOne / OneToOne by setting id to null", () => {
    contact.update({ data: { id: "1", version: 0, title: { select: { id: null } } } });
    address.update({ data: { id: "1", version: 0, country: { select: { id: null } } } });
  });

  test("ManyToMany: create new / link existing / link multiple", () => {
    contact.create({ data: { firstName: "a", lastName: "b", circles: { create: [{ code: "x", name: "y" }] } } });
    contact.update({ data: { id: "1", version: 0, circles: { select: [{ id: 1 }, { id: 2 }] } } });
    contact.update({ data: { id: "1", version: 0, circles: { create: [{ code: "z", name: "z" }], select: [{ id: 3 }] } } });
  });

  test("update: identity + fields + bigdecimal + null + nested", () => {
    contact.update({ data: { id: "1", version: 0, firstName: "a" } });
    country.update({ data: { id: "1", version: 2, population: "5" } });
    country.update({ data: { id: "1", version: 2, population: null } });
    contact.update({ data: { id: "1", version: 0, title: { select: { id: 2 } } } });
    contact.update({ data: { id: "1", version: 0, addresses: { create: [{ street: "x", contact: { select: { id: 1 } } }], remove: [9] } } });
  });

  test("OneToMany full update — create + update + remove in one call", () => {
    contact.update({
      data: {
        id: "1",
        version: 0,
        addresses: {
          create: [{ street: "New Rd" }],
          update: [{ id: "2", version: 1, city: "Paris" }],
          remove: [9, 10],
        },
      },
    });
  });

  test("bulk + count + delete", () => {
    contact.count();
    country.count({ where: { isMember: true } });
    contact.delete({ id: 1, version: 0 });
    country.createAll({ data: [{ code: "A", name: "A" }, { code: "B", name: "B", population: 5 }] });
    country.updateAll({ set: { isMember: true }, where: { isMember: null } });
    country.updateAll({ set: { population: "9.99" } });
    contact.deleteAll({ where: { email: null } });
    contact.deleteAll({});
    contact.updateAll({ set: { title: { id: null } } });
    contact.updateAll({ set: { email: null } });
  });
});

describe("valid: payload narrows for mutations and carries metadata", () => {
  test("create with select narrows return type", () => {
    const r = country.create({ data: { code: "US", name: "USA" }, select: { code: true } });
    type R = Awaited<typeof r>;
    expectTypeOf<R>().toHaveProperty("code");
    expectTypeOf<R>().not.toHaveProperty("name");
  });

  test("create without select returns PayloadSimple (all scalars, no relations)", () => {
    const r = country.create({ data: { code: "US", name: "USA" } });
    type R = Awaited<typeof r>;
    expectTypeOf<R>().toHaveProperty("code");
    expectTypeOf<R>().toHaveProperty("name");
  });

  test("update with select narrows return type", () => {
    const r = country.update({ data: { id: "1", version: 0 }, select: { name: true } });
    type R = Awaited<typeof r>;
    expectTypeOf<R>().toHaveProperty("name");
    expectTypeOf<R>().not.toHaveProperty("code");
  });

  test("find results carry cursor pagination metadata", () => {
    const rs = contact.find({ take: 10 });
    type R = Awaited<typeof rs>[number];
    expectTypeOf<R>().toHaveProperty("_cursor");
    expectTypeOf<R>().toHaveProperty("_hasNext");
    expectTypeOf<R>().toHaveProperty("_hasPrev");
    expectTypeOf<R>().toHaveProperty("_count");
  });
});

describe("valid: payload narrows to selection (inference must be preserved)", () => {
  test("findOne narrowing across scalar / to-one / to-many", () => {
    const r = contact.findOne({ select: { firstName: true, title: { name: true }, addresses: { select: { street: true } } } });
    type R = NonNullable<Awaited<typeof r>>;
    expectTypeOf<R["firstName"]>().toEqualTypeOf<string>();
    expectTypeOf<R>().toHaveProperty("id");
    expectTypeOf<R>().toHaveProperty("version");
    expectTypeOf<R>().toHaveProperty("title");
    expectTypeOf<R>().not.toHaveProperty("lastName");
    expectTypeOf<R>().not.toHaveProperty("email");
    type Ti = NonNullable<R["title"]>;
    expectTypeOf<Ti["name"]>().toEqualTypeOf<string>();
    expectTypeOf<Ti>().not.toHaveProperty("code");
    type Ad = NonNullable<R["addresses"]>;
    expectTypeOf<Ad>().toBeArray();
    expectTypeOf<NonNullable<Ad[number]>["street"]>().toEqualTypeOf<string>();
  });

  test("find returns an array; aggregate result narrows to operations", () => {
    const rs = contact.find({ select: { firstName: true } });
    expectTypeOf<Awaited<typeof rs>>().toBeArray();
    const agg = country.aggregate({ avg: { population: true }, count: { id: true } });
    type AG = Awaited<typeof agg>;
    expectTypeOf<AG>().toBeArray();
    expectTypeOf<AG[number]>().toHaveProperty("avg");
    expectTypeOf<AG[number]>().toHaveProperty("count");
  });
});

describe("valid: Payload type utilities and satisfies pattern", () => {
  test("satisfies SelectOptions enables pre-built selects and Payload type extraction", () => {
    const sel = { firstName: true, title: { name: true } } satisfies SelectOptions<Contact>;
    contact.findOne({ select: sel });
    type Result = NonNullable<Payload<Contact, { select: typeof sel }>>;
    expectTypeOf<Result>().toHaveProperty("firstName");
    expectTypeOf<Result>().not.toHaveProperty("lastName");
    expectTypeOf<Result>().toHaveProperty("title");
  });

  test("satisfies WhereOptions enables pre-built filters", () => {
    const filter = { email: { ne: null }, firstName: { like: "A%" } } satisfies WhereOptions<Contact>;
    contact.findOne({ where: filter });
    contact.find({ where: filter, take: 5 });
  });

  test("Payload<T, {select: ...}> narrows correctly for country", () => {
    const sel = { code: true, isMember: true } satisfies SelectOptions<Country>;
    type Result = NonNullable<Payload<Country, { select: typeof sel }>>;
    expectTypeOf<Result>().toHaveProperty("code");
    expectTypeOf<Result>().toHaveProperty("isMember");
    expectTypeOf<Result>().not.toHaveProperty("name");
    expectTypeOf<Result>().not.toHaveProperty("population");
  });
});

describe("valid: non-fresh values are only assignability-checked (no EPC)", () => {
  test("variables bypass excess-property checking", () => {
    const dynWhere = { firstName: { eq: "x" }, bogusVar: 1 };
    contact.findOne({ where: dynWhere });
  });
});

// ===========================================================================
// NEGATIVE — invalid usage that must be rejected
// ===========================================================================

describe("rejects excess keys at every depth", () => {
  test("top-level options", () => {
    // @ts-expect-error unknown top-level option in find
    contact.find({ bogus: 1 });
    // @ts-expect-error unknown top-level option in findOne
    contact.findOne({ bogusTop: 1 });
    // @ts-expect-error unknown top-level option in aggregate
    country.aggregate({ bogusAgg: 1 });
    // @ts-expect-error unknown top-level option in create
    contact.create({ data: { firstName: "a", lastName: "b" }, bogusOpt: 1 });
    // @ts-expect-error unknown top-level option in update
    contact.update({ data: { id: 1, version: 0 }, bogusOpt: 1 });
    // @ts-expect-error unknown top-level option in createAll
    country.createAll({ data: [{ code: "A", name: "A" }], bogus: 1 });
  });

  test("inside where (every depth)", () => {
    // @ts-expect-error unknown key in where
    contact.findOne({ where: { firstName: "a", bogusW: 1 } });
    // @ts-expect-error unknown key in a to-one relation where
    contact.findOne({ where: { title: { name: "x", bogusR: 1 } } });
    // @ts-expect-error unknown key in a to-many relation where
    contact.findOne({ where: { addresses: { city: "x", bogusTM: 1 } } });
    // @ts-expect-error unknown key in a deeply nested relation where
    contact.findOne({ where: { addresses: { country: { code: "US", bogusDeep: 1 } } } });
    // @ts-expect-error unknown key inside an OR[] branch
    contact.findOne({ where: { OR: [{ firstName: "a" }, { bogusOr: 1 }] } });
    // @ts-expect-error unknown key inside a nested AND[]/NOT[] branch
    contact.findOne({ where: { AND: [{ NOT: [{ bogusNot: 1 }] }] } });
  });

  test("inside select (every depth)", () => {
    // @ts-expect-error unknown key in select
    contact.findOne({ select: { firstName: true, bogusS: true } });
    // @ts-expect-error unknown key in a to-one related select
    contact.findOne({ select: { title: { name: true, bogusST: true } } });
    // @ts-expect-error unknown key in a to-many related select
    contact.findOne({ select: { addresses: { select: { street: true, bogusAS: true } } } });
    // @ts-expect-error unknown key in a where nested under a to-many select
    contact.findOne({ select: { addresses: { where: { bogusAW: 1 }, select: { street: true } } } });
    // @ts-expect-error unknown key in an orderBy nested under a to-many select
    contact.findOne({ select: { addresses: { orderBy: { bogusAO: "ASC" }, select: { street: true } } } });
    // @ts-expect-error unknown query option in a to-many select
    contact.findOne({ select: { addresses: { bogusTMopt: 1, select: { street: true } } } });
  });

  test("inside orderBy", () => {
    // @ts-expect-error unknown key in orderBy
    contact.find({ orderBy: { firstName: "ASC", bogusO: "ASC" } });
    // @ts-expect-error unknown key in a nested relation orderBy
    contact.find({ orderBy: { title: { bogusNO: "ASC" } } });
    // @ts-expect-error Text (lazy) fields have no orderable type
    contact.find({ orderBy: { notes: "ASC" } });
    // @ts-expect-error Binary (lazy) fields have no orderable type
    contact.find({ orderBy: { image: "ASC" } });
    // @ts-expect-error orderBy direction is case-sensitive ("ASC" | "DESC")
    contact.find({ orderBy: { firstName: "asc" } });
  });

  test("inside create / update data", () => {
    // @ts-expect-error unknown key in create data
    contact.create({ data: { firstName: "a", lastName: "b", bogusD: 1 } });
    // @ts-expect-error unknown key in a nested create
    contact.create({ data: { firstName: "a", lastName: "b", title: { create: { code: "x", name: "y", bogusNC: 1 } } } });
    // @ts-expect-error unknown key in a nested relation select-link
    contact.create({ data: { firstName: "a", lastName: "b", title: { select: { bogusSel: 1 } } } });
    // @ts-expect-error unknown key in update data
    contact.update({ data: { id: 1, version: 0, bogusU: 1 } });
  });

  test("update data must include both id and version", () => {
    // @ts-expect-error update data requires id
    contact.update({ data: { version: 0, firstName: "x" } });
    // @ts-expect-error update data requires version
    contact.update({ data: { id: 1, firstName: "x" } });
  });

  test("required mappedBy field cannot be omitted in a direct create", () => {
    // a direct address.create has no parent to auto-fill the mappedBy field from
    // @ts-expect-error missing required mappedBy field 'contact'
    address.create({ data: { street: "Main St" } });
  });

  test("nested create only relaxes the mappedBy field, nothing else", () => {
    // @ts-expect-error street is still required in a nested create
    contact.create({ data: { firstName: "a", lastName: "b", addresses: { create: [{ city: "NY" }] } } });
    // @ts-expect-error unknown key inside an explicitly-passed mappedBy link
    contact.create({ data: { firstName: "a", lastName: "b", addresses: { create: [{ street: "x", contact: { select: { bogusBR: 1 } } }] } } });
  });

  test("inside aggregate", () => {
    // @ts-expect-error unknown field in an avg selection
    country.aggregate({ avg: { bogusAvg: true } });
    // @ts-expect-error unknown field in a having clause
    country.aggregate({ count: { code: true }, having: { count: { bogusH: { gt: 1 } } } });
    // @ts-expect-error unknown field in an aggregate orderBy
    country.aggregate({ groupBy: { isMember: true }, orderBy: { count: { bogusOB: "ASC" } } });
    // @ts-expect-error unknown key in an aggregate where
    country.aggregate({ groupBy: { isMember: true }, where: { bogusAW: 1 } });
    // @ts-expect-error string field is not numeric — cannot be used with avg
    country.aggregate({ avg: { name: true } });
    // @ts-expect-error string field is not numeric — cannot be used with sum
    country.aggregate({ sum: { code: true } });
    // @ts-expect-error boolean field is not numeric — cannot be used with avg
    country.aggregate({ avg: { isMember: true } });
  });

  test("wrong value representations are rejected", () => {
    // @ts-expect-error int filters accept numbers only
    country.findOne({ where: { rank: { gt: "1" } } });
    // @ts-expect-error int shorthand must be a number
    country.findOne({ where: { rank: "2" } });
    // @ts-expect-error int create input must be a number
    country.create({ data: { code: "X", name: "X", rank: "5" } });
    // @ts-expect-error boolean filter rejects strings
    country.findOne({ where: { isMember: "true" } });
    // @ts-expect-error DateTime create input is a Date object — strings are filter-only
    contact.create({ data: { firstName: "a", lastName: "b", registeredOn: "2020-01-01" } });
    // @ts-expect-error JSON create input is a Promise, not a plain object
    contact.create({ data: { firstName: "a", lastName: "b", attrs: { level: 3 } } });
  });

  test("concrete-typed methods still EPC via their param type (no guard needed)", () => {
    // @ts-expect-error count uses a concrete QueryOptions param; fresh-literal EPC applies
    country.count({ where: { isMember: true }, bogusCount: 1 });
    // @ts-expect-error updateAll set is concrete BulkSetOptions; fresh-literal EPC applies
    country.updateAll({ set: { bogusSet: 1 }, where: { isMember: true } });
    // @ts-expect-error deleteAll where is concrete; fresh-literal EPC applies
    contact.deleteAll({ where: { bogusDW: 1 } });
  });
});
