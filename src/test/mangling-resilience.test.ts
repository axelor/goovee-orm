import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createClient, type GooveeClient } from "./db/client";
import { Address, Bio, Contact, Title } from "./db/models";

// Bundlers (webpack, turbopack) mangle top-level class identifiers in
// production builds, which changes Function.name at runtime. TypeORM captures
// EntityMetadata.targetName / .name from `(EntityClass as Function).name` once
// during DataSource.initialize(); any code that later compares those names to
// values baked at compile time silently mismatches.
//
// These tests reproduce that scenario by mutating Function.name on specific
// entity classes immediately before initializing a fresh DataSource, then
// restoring the originals so unrelated tests run later see entities under their
// real identity.

type Cls = { name: string };

const define = (klass: Cls, value: string) => {
  Object.defineProperty(klass, "name", { value, configurable: true });
};

describe("mangling resilience for entity schema lookups", () => {
  let client: GooveeClient;
  const original = {
    Contact: Contact.name,
    Title: Title.name,
    Address: Address.name,
    Bio: Bio.name,
  };

  const restoreAll = () => {
    define(Contact, original.Contact);
    define(Title, original.Title);
    define(Address, original.Address);
    define(Bio, original.Bio);
  };

  afterEach(async () => {
    restoreAll();
    if (client?.$connected) await client.$disconnect();
  });

  const connectWith = async (
    mangle: () => void,
    features: Parameters<typeof createClient>[0]["features"] = {},
  ) => {
    mangle();
    client = createClient({ features });
    await client.$connect();
    // metadata is now cached; restore the real Function.name so any code that
    // reads it later (e.g. other test files) sees the original identity.
    restoreAll();
    await client.$sync(true);
  };

  describe("isStringField (parser/context.ts)", () => {
    beforeEach(async () => {
      await connectWith(() => define(Contact, "a"), {
        normalization: { lowerCase: true, unaccent: true },
      });
      await client.$raw("CREATE EXTENSION IF NOT EXISTS unaccent");
    });

    it("applies unaccent normalization when entity class name is mangled", async () => {
      await client.contact.create({
        data: { firstName: "José", lastName: "González" },
      });

      const results = await client.contact.find({
        select: { firstName: true },
        where: { firstName: "Jose" },
      });

      expect(results).toHaveLength(1);
      expect(results[0].firstName).toBe("José");
    });

    it("applies lowerCase normalization when entity class name is mangled", async () => {
      await client.contact.create({
        data: { firstName: "John", lastName: "Smith" },
      });

      const results = await client.contact.find({
        select: { firstName: true },
        where: { firstName: "john" },
      });

      expect(results).toHaveLength(1);
      expect(results[0].firstName).toBe("John");
    });
  });

  describe("relation handling under mangling", () => {
    it("ManyToOne reference resolves the inverse entity repo when inverse class is mangled", async () => {
      // Title is the inverse side of Contact.title — mangle it.
      await connectWith(() => define(Title, "b"));

      const { id: titleId } = await client.title.create({
        data: { code: "MR", name: "Mr." },
      });

      // This exercises RelationHandlers.handleReference, which calls
      // repo.manager.getRepository(rMeta.name) on the unfixed code.
      const created = await client.contact.create({
        data: {
          firstName: "John",
          lastName: "Doe",
          title: { select: { id: titleId } },
        },
        select: { id: true, title: { id: true, name: true } },
      });

      expect(created.title?.name).toBe("Mr.");
    });

    it("OneToMany collection-create resolves the inverse entity repo when inverse class is mangled", async () => {
      // Address is the inverse side of Contact.addresses — mangle it.
      await connectWith(() => define(Address, "c"));

      // RelationHandlers.handleCollection → getRepository(rMeta.name) on unfixed.
      const created = await client.contact.create({
        data: {
          firstName: "Jane",
          lastName: "Doe",
          addresses: {
            create: [{ street: "1 Main St", city: "Springfield" }],
          },
        },
        select: {
          id: true,
          addresses: { select: { id: true, street: true, city: true } },
        },
      });

      expect(created.addresses).toHaveLength(1);
      expect(created.addresses?.[0].street).toBe("1 Main St");
    });

    it("relation query loads collection when inverse class is mangled", async () => {
      // doQuery in query.ts also reads relation.inverseEntityMetadata.name.
      await connectWith(() => define(Address, "d"));

      const { id } = await client.contact.create({
        data: {
          firstName: "Q",
          lastName: "User",
          addresses: { create: [{ street: "Elm", city: "Town" }] },
        },
      });

      const found = await client.contact.findOne({
        where: { id },
        select: {
          id: true,
          addresses: { select: { id: true, street: true } },
        },
      });

      expect(found?.addresses).toHaveLength(1);
      expect(found?.addresses?.[0].street).toBe("Elm");
    });
  });

  describe("relation reference resolved by String field under mangling", () => {
    it("normalization applies on inverse entity's String field when inverse class is mangled", async () => {
      // Mangle Title (the inverse side) so its metadata.targetName is "n".
      // Then look up a Title by its String `name` with normalization features
      // enabled — this exercises the inverse-side parser's isStringField path.
      await connectWith(
        () => define(Title, "n"),
        { normalization: { lowerCase: true, unaccent: true } },
      );
      await client.$raw("CREATE EXTENSION IF NOT EXISTS unaccent");

      await client.title.create({ data: { code: "MS", name: "José" } });

      const created = await client.contact.create({
        data: {
          firstName: "Z",
          lastName: "User",
          title: { select: { name: "Jose" } }, // unaccented search on Title.name
        },
        select: { id: true, title: { id: true, name: true } },
      });

      expect(created.title?.name).toBe("José");
    });
  });

  // The PR 18 description argues `getRepository(rMeta.name)` "works
  // incidentally" because both sides use the mangled value. This test checks
  // that argument by forcing a *collision* — two different entity classes
  // mangled to the same Function.name. On unfixed code, getRepository(string)
  // can then return the wrong entity's repository; on PR 18, getRepository
  // receives the constructor reference (rMeta.target) and stays correct.
  describe("relation handling under name collision", () => {
    it("ManyToOne reference still picks the right inverse repo when two entity classes mangle to the same name", async () => {
      await connectWith(() => {
        define(Title, "x");
        define(Bio, "x");
      });

      const { id: titleId } = await client.title.create({
        data: { code: "DR", name: "Dr." },
      });

      const created = await client.contact.create({
        data: {
          firstName: "C",
          lastName: "User",
          title: { select: { id: titleId } },
        },
        select: { id: true, title: { id: true, name: true } },
      });

      expect(created.title?.name).toBe("Dr.");
    });
  });
});
