// Output-type tests: assert what repository methods RETURN, derived from the
// runtime implementation (EntityRepository, doQuery, runAggregate, ensureLazy,
// getSimpleSelect) — not from the declared types. Comments name the runtime
// source of truth for each expectation. Run: `pnpm test:types`
import { describe, expectTypeOf, test } from "vitest";

import { AddressType } from "./db/models";
import type { BigDecimal, JsonObject } from "@goovee/orm";
import type { TestClient } from "./client.utils";

declare const client: TestClient;
const { contact, country, address } = client;

describe("query payload outputs", () => {
  test("selected scalars carry their column types; nullable columns admit null", () => {
    const r = contact.findOne({
      select: { firstName: true, email: true, registeredOn: true, dateOfBirth: true, timeOfBirth: true },
    });
    type R = NonNullable<Awaited<typeof r>>;
    expectTypeOf<R["firstName"]>().toEqualTypeOf<string>();
    expectTypeOf<R["email"]>().toEqualTypeOf<string | null>();
    // timestamp columns come back as Date instances, date/time as strings
    expectTypeOf<R["registeredOn"]>().toEqualTypeOf<Date | null>();
    expectTypeOf<R["dateOfBirth"]>().toEqualTypeOf<string | null>();
    expectTypeOf<R["timeOfBirth"]>().toEqualTypeOf<string | null>();
    // identity is always loaded; the generated Model declares id as a string
    // (PostgreSQL bigint columns come back as strings)
    expectTypeOf<R["id"]>().toEqualTypeOf<string>();
    expectTypeOf<R["version"]>().toEqualTypeOf<number>();
  });

  test("enum, decimal, int and boolean payloads", () => {
    const r = address.findOne({ select: { type: true } });
    type R = NonNullable<Awaited<typeof r>>;
    expectTypeOf<R["type"]>().toEqualTypeOf<AddressType | null>();
    const c = country.findOne({ select: { population: true, rank: true, isMember: true } });
    type C = NonNullable<Awaited<typeof c>>;
    // numeric columns use the BigDecimal transformer
    expectTypeOf<C["population"]>().toEqualTypeOf<BigDecimal | null>();
    expectTypeOf<C["rank"]>().toEqualTypeOf<number | null>();
    expectTypeOf<C["isMember"]>().toEqualTypeOf<boolean | null>();
  });

  test("to-one references resolve to the narrowed object or null", () => {
    // doQuery: record[property] = related.length ? related[0] : null
    const r = contact.findOne({ select: { title: { name: true } } });
    type T = NonNullable<Awaited<typeof r>>["title"];
    expectTypeOf<NonNullable<T>["name"]>().toEqualTypeOf<string>();
    // null must stay in the type — a missing reference is assigned null
    expectTypeOf<T>().not.toEqualTypeOf<NonNullable<T>>();
  });

  test("selected collections are always arrays, never null", () => {
    // doQuery assigns `record[property] = related` for collections — an array
    // ([] when empty), never null
    const r = contact.findOne({ select: { addresses: { select: { street: true } } } });
    type A = NonNullable<Awaited<typeof r>>["addresses"];
    expectTypeOf<A>().toEqualTypeOf<NonNullable<A>>();
  });

  test("selected lazy fields are promises resolving to value-or-null", () => {
    // ensureLazy installs a getter that always returns a Promise; loadLazy
    // resolves `res?.[name] ?? null` — the field is never null, the awaited
    // value can be
    const r = contact.findOne({ select: { attrs: true, notes: true } });
    type R = NonNullable<Awaited<typeof r>>;
    expectTypeOf<R["attrs"]>().toEqualTypeOf<Promise<JsonObject | null>>();
    expectTypeOf<R["notes"]>().toEqualTypeOf<Promise<string | null>>();
  });

  test("cursor metadata: _cursor string, _hasNext/_hasPrev booleans", () => {
    const rs = contact.find({ take: 10 });
    type R = Awaited<typeof rs>[number];
    expectTypeOf<R["_cursor"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<R["_hasNext"]>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<R["_hasPrev"]>().toEqualTypeOf<boolean | undefined>();
  });

  test("_count metadata is a number", () => {
    // doQuery: record._count = count, where count = await sq.getCount()
    const rs = contact.find({ take: 10 });
    type R = Awaited<typeof rs>[number];
    expectTypeOf<R["_count"]>().toEqualTypeOf<number | undefined>();
  });
});

describe("mutation outputs", () => {
  test("create with select narrows and is non-null", () => {
    const r = country.create({ data: { code: "US", name: "USA" }, select: { code: true } });
    type R = Awaited<typeof r>;
    expectTypeOf<R["code"]>().toEqualTypeOf<string>();
    expectTypeOf<R>().toEqualTypeOf<NonNullable<R>>();
  });

  test("create without select returns simple scalars only", () => {
    // getSimpleSelect() picks non-relation columns that are not text/jsonb/oid,
    // so relations and lazy fields are not loaded
    const r = contact.create({ data: { firstName: "a", lastName: "b" } });
    type R = Awaited<typeof r>;
    expectTypeOf<R>().toHaveProperty("firstName");
    expectTypeOf<R>().toHaveProperty("registeredOn");
    expectTypeOf<R>().not.toHaveProperty("title");
    expectTypeOf<R>().not.toHaveProperty("addresses");
    expectTypeOf<R>().not.toHaveProperty("attrs");
    expectTypeOf<R>().not.toHaveProperty("notes");
  });

  test("update without select returns identity only", () => {
    const r = country.update({ data: { id: "1", version: 0 } });
    type R = Awaited<typeof r>;
    expectTypeOf<R>().toHaveProperty("id");
    expectTypeOf<R>().toHaveProperty("version");
    expectTypeOf<R>().not.toHaveProperty("name");
  });

  test("row-count results are numbers", () => {
    // count() returns sq.getCount(); delete/updateAll/deleteAll return
    // `affected ?? 0` — all numbers at runtime
    const n = contact.count();
    expectTypeOf<Awaited<typeof n>>().toEqualTypeOf<number>();
    const d = contact.delete({ id: 1, version: 0 });
    expectTypeOf<Awaited<typeof d>>().toEqualTypeOf<number>();
    const u = country.updateAll({ set: { isMember: true } });
    expectTypeOf<Awaited<typeof u>>().toEqualTypeOf<number>();
    const x = contact.deleteAll({});
    expectTypeOf<Awaited<typeof x>>().toEqualTypeOf<number>();
  });
});

describe("aggregate outputs", () => {
  test("computed aggregates are the driver's exact strings", () => {
    // pg widens computed aggregates (sum(int) → bigint, avg(int) → numeric)
    // and the driver delivers them as exact strings — the client passes them
    // through; converting to the right precision is the caller's call.
    // count is never null (NULL → "0"); sum/avg are null over empty or
    // all-null sets
    const a = country.aggregate({ count: { id: true }, avg: { population: true }, sum: { population: true } });
    type A = Awaited<typeof a>[number];
    expectTypeOf<A["count"]["id"]>().toEqualTypeOf<string>();
    expectTypeOf<A["avg"]["population"]>().toEqualTypeOf<string | null>();
    expectTypeOf<A["sum"]["population"]>().toEqualTypeOf<string | null>();
  });

  test("min/max admit null for empty sets", () => {
    // the database yields NULL for min/max over no rows or all-null columns
    const a = country.aggregate({ min: { name: true }, max: { name: true } });
    type A = Awaited<typeof a>[number];
    expectTypeOf<A["min"]["name"]>().toEqualTypeOf<string | null>();
    expectTypeOf<A["max"]["name"]>().toEqualTypeOf<string | null>();
  });

  test("groupBy values of nullable columns admit null", () => {
    // convertAggregateValue passes column nulls through for groupBy
    const a = country.aggregate({ groupBy: { isMember: true }, count: { id: true } });
    type A = Awaited<typeof a>[number];
    expectTypeOf<A["groupBy"]["isMember"]>().toEqualTypeOf<boolean | null>();
  });

  test("groupBy decimal values stay BigDecimal", () => {
    // a group key is a stored column value — it keeps the column's model
    // type, the same BigDecimal a select would deliver
    const a = country.aggregate({ groupBy: { population: true }, count: { id: true } });
    type A = Awaited<typeof a>[number];
    expectTypeOf<A["groupBy"]["population"]>().toEqualTypeOf<BigDecimal | null>();
  });

  test("min/max and groupBy carry the column's model type", () => {
    // min/max/groupBy return stored column values: ints are numbers,
    // decimals are BigDecimal, timestamps are Dates, bigint ids are strings
    const a = country.aggregate({ sum: { rank: true }, avg: { rank: true }, min: { rank: true }, max: { rank: true } });
    type A = Awaited<typeof a>[number];
    expectTypeOf<A["sum"]["rank"]>().toEqualTypeOf<string | null>();
    expectTypeOf<A["avg"]["rank"]>().toEqualTypeOf<string | null>();
    expectTypeOf<A["min"]["rank"]>().toEqualTypeOf<number | null>();
    expectTypeOf<A["max"]["rank"]>().toEqualTypeOf<number | null>();
    const d = country.aggregate({ min: { population: true }, max: { population: true } });
    type D = Awaited<typeof d>[number];
    expectTypeOf<D["min"]["population"]>().toEqualTypeOf<BigDecimal | null>();
    expectTypeOf<D["max"]["population"]>().toEqualTypeOf<BigDecimal | null>();
    const c = contact.aggregate({ min: { registeredOn: true }, groupBy: { id: true }, count: { id: true } });
    type C = Awaited<typeof c>[number];
    expectTypeOf<C["min"]["registeredOn"]>().toEqualTypeOf<Date | null>();
    expectTypeOf<C["groupBy"]["id"]>().toEqualTypeOf<string | null>();
  });

  test("temporal and enum aggregate values match their select types", () => {
    // date/time columns aggregate as strings, timestamps as Dates, enums as
    // their enum type — the same shapes a select would deliver
    const c = contact.aggregate({ groupBy: { dateOfBirth: true, timeOfBirth: true, registeredOn: true }, count: { id: true } });
    type C = Awaited<typeof c>[number];
    expectTypeOf<C["groupBy"]["dateOfBirth"]>().toEqualTypeOf<string | null>();
    expectTypeOf<C["groupBy"]["timeOfBirth"]>().toEqualTypeOf<string | null>();
    expectTypeOf<C["groupBy"]["registeredOn"]>().toEqualTypeOf<Date | null>();
    const m = contact.aggregate({ min: { dateOfBirth: true }, max: { timeOfBirth: true } });
    type M = Awaited<typeof m>[number];
    expectTypeOf<M["min"]["dateOfBirth"]>().toEqualTypeOf<string | null>();
    expectTypeOf<M["max"]["timeOfBirth"]>().toEqualTypeOf<string | null>();
    const e = address.aggregate({ groupBy: { type: true }, count: { id: true } });
    type E = Awaited<typeof e>[number];
    expectTypeOf<E["groupBy"]["type"]>().toEqualTypeOf<AddressType | null>();
  });
});
