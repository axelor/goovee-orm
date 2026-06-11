import { describe, expect, it } from "vitest";
import { getTestClient } from "./client.utils";

describe("nested collection pagination", async () => {
  const client = await getTestClient();

  const createContactWithAddresses = async (
    firstName: string,
    streets: string[],
  ) => {
    const contact = await client.contact.create({
      data: { firstName, lastName: "Tester" },
    });
    for (const street of streets) {
      await client.address.create({
        data: { contact: { select: { id: contact.id } }, street },
      });
    }
    return contact;
  };

  const createTaggedAddress = async (
    contactId: string,
    street: string,
    tags: string[],
  ) => {
    const address = await client.address.create({
      data: { contact: { select: { id: contactId } }, street },
    });
    for (const name of tags) {
      await client.addressTag.create({
        data: { name, address: { select: { id: address.id } } },
      });
    }
    return address;
  };

  it("should limit each record's collection to `take` items", async () => {
    await createContactWithAddresses("First", ["A1", "A2", "A3"]);
    await createContactWithAddresses("Second", ["B1", "B2"]);

    const contacts = await client.contact.find({
      select: {
        firstName: true,
        addresses: {
          select: { street: true },
          orderBy: { id: "DESC" },
          take: 1,
        },
      },
      orderBy: { id: "ASC" },
    });

    expect(contacts).toHaveLength(2);

    // both contacts have addresses, so each must come back with exactly one:
    // its own newest
    expect(contacts[0].addresses).toHaveLength(1);
    expect(contacts[0].addresses?.[0]?.street).toBe("A3");
    expect(contacts[1].addresses).toHaveLength(1);
    expect(contacts[1].addresses?.[0]?.street).toBe("B2");
  });

  it("should skip items within each record's collection", async () => {
    await createContactWithAddresses("First", ["A1", "A2", "A3"]);
    await createContactWithAddresses("Second", ["B1", "B2"]);

    const contacts = await client.contact.find({
      select: {
        firstName: true,
        addresses: {
          select: { street: true },
          orderBy: { id: "DESC" },
          take: 1,
          skip: 1,
        },
      },
      orderBy: { id: "ASC" },
    });

    expect(contacts).toHaveLength(2);

    // skipping the newest address leaves each contact's second-newest
    expect(contacts[0].addresses?.[0]?.street).toBe("A2");
    expect(contacts[1].addresses?.[0]?.street).toBe("B1");
  });

  it("should take from the end of each record's collection when take is negative", async () => {
    await createContactWithAddresses("First", ["A1", "A2", "A3"]);
    await createContactWithAddresses("Second", ["B1", "B2"]);

    const contacts = await client.contact.find({
      select: {
        firstName: true,
        addresses: {
          select: { street: true },
          orderBy: { id: "ASC" },
          take: -1,
        },
      },
      orderBy: { id: "ASC" },
    });

    expect(contacts).toHaveLength(2);

    // like the top-level take, a negative take selects the last items, still
    // returned in the requested order
    expect(contacts[0].addresses?.map((address) => address.street)).toEqual([
      "A3",
    ]);
    expect(contacts[1].addresses?.map((address) => address.street)).toEqual([
      "B2",
    ]);
  });

  it("should sort each record's collection by the nested orderBy", async () => {
    await createContactWithAddresses("First", ["A1", "A2", "A3"]);
    await createContactWithAddresses("Second", ["B1", "B2"]);

    const contacts = await client.contact.find({
      select: {
        firstName: true,
        addresses: {
          select: { street: true },
          orderBy: { id: "DESC" },
        },
      },
      orderBy: { id: "ASC" },
    });

    expect(contacts).toHaveLength(2);
    expect(contacts[0].addresses?.map((address) => address.street)).toEqual([
      "A3",
      "A2",
      "A1",
    ]);
    expect(contacts[1].addresses?.map((address) => address.street)).toEqual([
      "B2",
      "B1",
    ]);
  });

  it("should combine a filter on a single-valued relation with a per-record take", async () => {
    const india = await client.country.create({
      data: { code: "IN", name: "India" },
    });
    const france = await client.country.create({
      data: { code: "FR", name: "France" },
    });

    const alice = await client.contact.create({
      data: { firstName: "Alice", lastName: "Tester" },
    });
    const bob = await client.contact.create({
      data: { firstName: "Bob", lastName: "Tester" },
    });
    const createAddress = (
      contactId: string,
      street: string,
      country: string,
    ) =>
      client.address.create({
        data: {
          contact: { select: { id: contactId } },
          street,
          country: { select: { id: country } },
        },
      });
    await createAddress(alice.id, "A1", france.id);
    await createAddress(alice.id, "A2", india.id);
    await createAddress(alice.id, "A3", india.id);
    await createAddress(bob.id, "B1", india.id);
    await createAddress(bob.id, "B2", france.id);

    const contacts = await client.contact.find({
      select: {
        firstName: true,
        addresses: {
          select: { street: true },
          where: { country: { name: "India" } },
          orderBy: { id: "DESC" },
          take: 1,
        },
      },
      orderBy: { id: "ASC" },
    });

    expect(contacts).toHaveLength(2);

    // each contact gets their newest address among the matching ones only
    expect(contacts[0].addresses?.map((address) => address.street)).toEqual([
      "A3",
    ]);
    expect(contacts[1].addresses?.map((address) => address.street)).toEqual([
      "B1",
    ]);
  });

  it("should not double-count an item matching a collection filter twice", async () => {
    const alice = await client.contact.create({
      data: { firstName: "Alice", lastName: "Tester" },
    });
    const bob = await client.contact.create({
      data: { firstName: "Bob", lastName: "Tester" },
    });
    await createTaggedAddress(alice.id, "A1", ["Red"]);
    // matches the filter through two of its tags — must still count once
    await createTaggedAddress(alice.id, "A2", ["Red", "Rose"]);
    await createTaggedAddress(alice.id, "A3", ["Blue"]);
    await createTaggedAddress(bob.id, "B1", ["Rose"]);
    await createTaggedAddress(bob.id, "B2", ["Blue"]);

    const contacts = await client.contact.find({
      select: {
        firstName: true,
        addresses: {
          select: { street: true },
          where: { tags: { name: { like: "R%" } } },
          orderBy: { id: "DESC" },
          take: 1,
        },
      },
      orderBy: { id: "ASC" },
    });

    expect(contacts).toHaveLength(2);

    // exactly one address each: the newest one having a matching tag
    expect(contacts[0].addresses?.map((address) => address.street)).toEqual([
      "A2",
    ]);
    expect(contacts[1].addresses?.map((address) => address.street)).toEqual([
      "B1",
    ]);
  });

  it("should paginate collections at every nesting level", async () => {
    const alice = await client.contact.create({
      data: { firstName: "Alice", lastName: "Tester" },
    });
    const bob = await client.contact.create({
      data: { firstName: "Bob", lastName: "Tester" },
    });
    await createTaggedAddress(alice.id, "A1", ["A1-old", "A1-new"]);
    await createTaggedAddress(alice.id, "A2", ["A2-1", "A2-2", "A2-3"]);
    await createTaggedAddress(bob.id, "B1", ["B1-only"]);

    const contacts = await client.contact.find({
      select: {
        firstName: true,
        addresses: {
          select: {
            street: true,
            tags: {
              select: { name: true },
              orderBy: { id: "DESC" },
              take: 2,
            },
          },
          orderBy: { id: "DESC" },
          take: 1,
        },
      },
      orderBy: { id: "ASC" },
    });

    expect(contacts).toHaveLength(2);

    // each contact gets their newest address, and inside it only the two
    // newest tags of that address
    const aliceAddresses = contacts[0].addresses;
    expect(aliceAddresses?.map((address) => address.street)).toEqual(["A2"]);
    expect(aliceAddresses?.[0]?.tags?.map((tag) => tag.name)).toEqual([
      "A2-3",
      "A2-2",
    ]);

    const bobAddresses = contacts[1].addresses;
    expect(bobAddresses?.map((address) => address.street)).toEqual(["B1"]);
    expect(bobAddresses?.[0]?.tags?.map((tag) => tag.name)).toEqual([
      "B1-only",
    ]);
  });

  it("should limit many-to-many collections per record", async () => {
    const createCircle = (code: string) =>
      client.circle.create({ data: { code, name: code } });
    const c1 = await createCircle("c1");
    const c2 = await createCircle("c2");
    const c3 = await createCircle("c3");
    const c4 = await createCircle("c4");

    await client.contact.create({
      data: {
        firstName: "Alice",
        lastName: "Tester",
        circles: { select: [{ id: c1.id }, { id: c2.id }, { id: c3.id }] },
      },
    });
    await client.contact.create({
      data: {
        firstName: "Bob",
        lastName: "Tester",
        circles: { select: [{ id: c2.id }, { id: c4.id }] },
      },
    });

    const contacts = await client.contact.find({
      select: {
        firstName: true,
        circles: {
          select: { code: true },
          orderBy: { id: "DESC" },
          take: 1,
        },
      },
      orderBy: { id: "ASC" },
    });

    expect(contacts).toHaveLength(2);

    // shared circles must not leak one contact's limit into the other's
    expect(contacts[0].circles?.map((circle) => circle.code)).toEqual(["c3"]);
    expect(contacts[1].circles?.map((circle) => circle.code)).toEqual(["c4"]);
  });

  it("should not return a shared item beyond a record's limit because another record kept it", async () => {
    const old = await client.circle.create({
      data: { code: "old", name: "old" },
    });
    const fresh = await client.circle.create({
      data: { code: "new", name: "new" },
    });

    // "old" is Bob's newest circle but only Alice's second-newest; Alice's
    // result must not grow to two circles just because Bob keeps "old"
    await client.contact.create({
      data: {
        firstName: "Alice",
        lastName: "Tester",
        circles: { select: [{ id: old.id }, { id: fresh.id }] },
      },
    });
    await client.contact.create({
      data: {
        firstName: "Bob",
        lastName: "Tester",
        circles: { select: [{ id: old.id }] },
      },
    });

    const contacts = await client.contact.find({
      select: {
        firstName: true,
        circles: {
          select: { code: true },
          orderBy: { id: "DESC" },
          take: 1,
        },
      },
      orderBy: { id: "ASC" },
    });

    expect(contacts).toHaveLength(2);
    expect(contacts[0].circles?.map((circle) => circle.code)).toEqual(["new"]);
    expect(contacts[1].circles?.map((circle) => circle.code)).toEqual(["old"]);
  });

  it("should limit per record when filtering through a relation's collection", async () => {
    const g1 = await client.circle.create({ data: { code: "g1", name: "g1" } });
    const g2 = await client.circle.create({ data: { code: "g2", name: "g2" } });

    // Alice belongs to two matching circles, so her addresses match the
    // filter twice over; the limit must still count addresses, not matches
    const alice = await client.contact.create({
      data: {
        firstName: "Alice",
        lastName: "Tester",
        circles: { select: [{ id: g1.id }, { id: g2.id }] },
      },
    });
    const bob = await client.contact.create({
      data: {
        firstName: "Bob",
        lastName: "Tester",
        circles: { select: [{ id: g1.id }] },
      },
    });
    await client.address.create({
      data: { contact: { select: { id: alice.id } }, street: "A1" },
    });
    await client.address.create({
      data: { contact: { select: { id: alice.id } }, street: "A2" },
    });
    await client.address.create({
      data: { contact: { select: { id: bob.id } }, street: "B1" },
    });

    const contacts = await client.contact.find({
      select: {
        firstName: true,
        addresses: {
          select: { street: true },
          where: { contact: { circles: { code: { like: "g%" } } } },
          orderBy: { id: "DESC" },
          take: 1,
        },
      },
      orderBy: { id: "ASC" },
    });

    expect(contacts).toHaveLength(2);
    expect(contacts[0].addresses?.map((address) => address.street)).toEqual([
      "A2",
    ]);
    expect(contacts[1].addresses?.map((address) => address.street)).toEqual([
      "B1",
    ]);
  });

  it("should clamp a negative take window that runs past the list start", async () => {
    await createContactWithAddresses("First", ["A1", "A2", "A3"]);
    await createContactWithAddresses("Second", ["B1", "B2"]);

    const contacts = await client.contact.find({
      select: {
        firstName: true,
        addresses: {
          select: { street: true },
          orderBy: { id: "ASC" },
          take: -2,
          skip: 2,
        },
      },
      orderBy: { id: "ASC" },
    });

    // 3 addresses, skipping 2 from the end leaves only the first one — the
    // window is clamped at the list start and still returns 2 items, exactly
    // like the top-level take/skip on a 3-record table
    expect(contacts[0].addresses?.map((address) => address.street)).toEqual([
      "A1",
      "A2",
    ]);
    // a shorter list clamps the same way: the window stays anchored at the
    // list start
    expect(contacts[1].addresses?.map((address) => address.street)).toEqual([
      "B1",
      "B2",
    ]);
  });

  it("should clamp the negative take window also when filtering through a collection", async () => {
    const alice = await client.contact.create({
      data: { firstName: "Alice", lastName: "Tester" },
    });
    const bob = await client.contact.create({
      data: { firstName: "Bob", lastName: "Tester" },
    });
    await createTaggedAddress(alice.id, "A1", ["T"]);
    await createTaggedAddress(alice.id, "A2", ["T"]);
    await createTaggedAddress(alice.id, "A3", ["T"]);
    await createTaggedAddress(bob.id, "B1", ["T"]);
    await createTaggedAddress(bob.id, "B2", ["T"]);

    const contacts = await client.contact.find({
      select: {
        firstName: true,
        addresses: {
          select: { street: true },
          where: { tags: { name: "T" } },
          orderBy: { id: "ASC" },
          take: -2,
          skip: 2,
        },
      },
      orderBy: { id: "ASC" },
    });

    // same window, same clamp — the result must not depend on whether the
    // filter goes through a collection
    expect(contacts[0].addresses?.map((address) => address.street)).toEqual([
      "A1",
      "A2",
    ]);
    expect(contacts[1].addresses?.map((address) => address.street)).toEqual([
      "B1",
      "B2",
    ]);
  });

  it("should pick limited items in id order when no orderBy is given", async () => {
    const alice = await client.contact.create({
      data: { firstName: "Alice", lastName: "Tester" },
    });
    const bob = await client.contact.create({
      data: { firstName: "Bob", lastName: "Tester" },
    });
    const createAddress = (contactId: string, street: string) =>
      client.address.create({
        data: { contact: { select: { id: contactId } }, street },
      });
    const firstOfAlice = await createAddress(alice.id, "A1");
    await createAddress(alice.id, "A2");
    await createAddress(alice.id, "A3");
    const firstOfBob = await createAddress(bob.id, "B1");
    await createAddress(bob.id, "B2");
    /* Rewrite the first addresses so their physical rows move to the end of
     * the table — picking by storage order instead of id order now gives a
     * different answer. */
    await client.address.update({
      data: {
        id: firstOfAlice.id,
        version: firstOfAlice.version,
        area: "moved",
      },
    });
    await client.address.update({
      data: { id: firstOfBob.id, version: firstOfBob.version, area: "moved" },
    });

    const contacts = await client.contact.find({
      select: {
        firstName: true,
        addresses: {
          select: { street: true },
          take: 1,
        },
      },
      orderBy: { id: "ASC" },
    });

    expect(contacts[0].addresses?.map((address) => address.street)).toEqual([
      "A1",
    ]);
    expect(contacts[1].addresses?.map((address) => address.street)).toEqual([
      "B1",
    ]);
  });

  it("should pick limited items in id order also when filtering through a collection", async () => {
    const alice = await client.contact.create({
      data: { firstName: "Alice", lastName: "Tester" },
    });
    const bob = await client.contact.create({
      data: { firstName: "Bob", lastName: "Tester" },
    });
    const firstOfAlice = await createTaggedAddress(alice.id, "A1", ["T"]);
    await createTaggedAddress(alice.id, "A2", ["T"]);
    await createTaggedAddress(alice.id, "A3", ["T"]);
    const firstOfBob = await createTaggedAddress(bob.id, "B1", ["T"]);
    await createTaggedAddress(bob.id, "B2", ["T"]);
    /* Same physical-row shuffle as above: the limit must follow id order, not
     * storage order. */
    await client.address.update({
      data: {
        id: firstOfAlice.id,
        version: firstOfAlice.version,
        area: "moved",
      },
    });
    await client.address.update({
      data: { id: firstOfBob.id, version: firstOfBob.version, area: "moved" },
    });

    const contacts = await client.contact.find({
      select: {
        firstName: true,
        addresses: {
          select: { street: true },
          where: { tags: { name: "T" } },
          take: 1,
        },
      },
      orderBy: { id: "ASC" },
    });

    expect(contacts[0].addresses?.map((address) => address.street)).toEqual([
      "A1",
    ]);
    expect(contacts[1].addresses?.map((address) => address.street)).toEqual([
      "B1",
    ]);
  });

  it("should treat a null take as no limit", async () => {
    await createContactWithAddresses("First", ["A1", "A2", "A3"]);
    await createContactWithAddresses("Second", ["B1", "B2"]);

    const contacts = await client.contact.find({
      select: {
        firstName: true,
        addresses: {
          select: { street: true },
          orderBy: { id: "ASC" },
          // untyped callers can send null where the types say number
          take: null as unknown as number,
        },
      },
      orderBy: { id: "ASC" },
    });

    expect(contacts[0].addresses?.map((address) => address.street)).toEqual([
      "A1",
      "A2",
      "A3",
    ]);
    expect(contacts[1].addresses?.map((address) => address.street)).toEqual([
      "B1",
      "B2",
    ]);
  });

  it("should keep page metadata and cursor support on a single-record page", async () => {
    const contact = await createContactWithAddresses("First", [
      "A1",
      "A2",
      "A3",
    ]);

    // with a single parent the batched query is exactly that record's list,
    // so the nested take keeps the full top-level page semantics — this is
    // the path GraphQL nested connections use
    const found = await client.contact.findOne({
      where: { id: { eq: contact.id } },
      select: {
        addresses: {
          select: { street: true },
          orderBy: { id: "ASC" },
          take: 2,
        },
      },
    });

    const addresses = found?.addresses ?? [];
    expect(addresses.map((address) => address.street)).toEqual(["A1", "A2"]);

    const last = addresses[addresses.length - 1] as (typeof addresses)[0] & {
      _count?: number;
      _cursor?: string;
    };
    expect(last._count).toBe(3);
    expect(last._cursor).toBeTruthy();

    const next = await client.contact.findOne({
      where: { id: { eq: contact.id } },
      select: {
        addresses: {
          select: { street: true },
          orderBy: { id: "ASC" },
          take: 2,
          cursor: last._cursor,
        },
      },
    });

    expect(next?.addresses?.map((address) => address.street)).toEqual(["A3"]);
  });

  it("should limit per record when ordering by a column of a nested collection", async () => {
    const alice = await client.contact.create({
      data: { firstName: "Alice", lastName: "Tester" },
    });
    const bob = await client.contact.create({
      data: { firstName: "Bob", lastName: "Tester" },
    });
    await createTaggedAddress(alice.id, "A1", ["zebra"]);
    await createTaggedAddress(alice.id, "A2", ["apple"]);
    await createTaggedAddress(alice.id, "A3", ["mango"]);
    await createTaggedAddress(bob.id, "B1", ["kiwi"]);
    await createTaggedAddress(bob.id, "B2", ["berry"]);

    const contacts = await client.contact.find({
      select: {
        firstName: true,
        addresses: {
          select: { street: true },
          orderBy: { tags: { name: "ASC" } },
          take: 1,
        },
      },
      orderBy: { id: "ASC" },
    });

    expect(contacts).toHaveLength(2);

    // each contact gets the address whose tag sorts first — alphabetical by
    // tag name, independent of address ids
    expect(contacts[0].addresses?.map((address) => address.street)).toEqual([
      "A2",
    ]);
    expect(contacts[1].addresses?.map((address) => address.street)).toEqual([
      "B2",
    ]);
  });
});
