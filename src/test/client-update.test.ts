import { describe, expect, it } from "vitest";
import { getTestClient } from "./client.utils";

describe("client update tests", async () => {
  const client = await getTestClient();

  it("should update record", async () => {
    const mr = await client.title.create({
      data: {
        code: "mr",
        name: "Mr.",
      },
    });
    const res = await client.title.update({
      data: {
        id: mr.id,
        version: mr.version,
        name: "MR",
      },
      select: {
        name: true,
      },
    });
    expect(res).toMatchObject({
      id: "1",
      version: 2,
      name: "MR",
    });
  });

  it("should update nested record", async () => {
    const c = await client.contact.create({
      data: {
        firstName: "Some",
        lastName: "Name",
        title: {
          create: {
            code: "mr",
            name: "Mr.",
          },
        },
      },
      select: {
        title: {
          id: true,
          version: true,
        },
      },
    });

    if (c.title) {
      const res = await client.contact.update({
        data: {
          id: c.id,
          version: c.version,
          title: {
            update: {
              id: c.title.id,
              version: c.title.version,
              name: "MR",
            },
          },
        },
        select: {
          id: true,
          title: {
            name: true,
          },
        },
      });

      expect(res).toBeDefined();
      expect(res.title).toBeDefined();
      expect(res.title?.name).toBe("MR");
    }
  });

  it("should update record and select reference", async () => {
    await client.title.create({
      data: {
        code: "mr",
        name: "Mr.",
      },
    });
    const c = await client.contact.create({
      data: {
        firstName: "Some",
        lastName: "NAME",
        title: {
          create: {
            code: "mrs",
            name: "Mrs",
          },
        },
      },
      select: {
        firstName: true,
        lastName: true,
        title: {
          code: true,
          name: true,
        },
      },
    });

    expect(c?.title?.name).toBe("Mrs");

    const x = await client.contact.update({
      data: {
        id: c.id,
        version: c.version,
        lastName: "Name",
        title: {
          select: {
            code: "mr",
          },
        },
      },
      select: {
        firstName: true,
        lastName: true,
        title: {
          code: true,
          name: true,
        },
      },
    });

    expect(x.lastName).toBe("Name");
    expect(x.title?.name).toBe("Mr.");
    expect(x.version).toBe(c.version + 1);
  });

  it("should update many-to-one field to null", async () => {
    const c = await client.contact.create({
      data: {
        firstName: "Some",
        lastName: "NAME",
        title: {
          create: {
            code: "mr",
            name: "Mr.",
          },
        },
      },
      select: {
        firstName: true,
        lastName: true,
        title: {
          code: true,
          name: true,
        },
      },
    });

    expect(c.title).toBeDefined();
    expect(c.title?.name).toBe("Mr.");

    const updated = await client.contact.update({
      data: {
        id: c.id,
        version: c.version,
        title: {
          select: {
            id: null,
          },
        },
      },
      select: {
        firstName: true,
        lastName: true,
        title: {
          code: true,
          name: true,
        },
      },
    });

    expect(updated.firstName).toBe("Some");
    expect(updated.lastName).toBe("NAME");
    expect(updated.title).toBeNull();
    expect(updated.version).toBe(c.version + 1);
  });

  it("should remove a collection field item with update", async () => {
    const contact = await client.contact.create({
      data: {
        firstName: "Some",
        lastName: "NAME",
        addresses: {
          create: {
            contact: {},
            street: "My HOME",
          },
        },
      },
      select: {
        addresses: {
          select: {
            street: true,
          },
        },
      },
    });

    expect(contact).toBeDefined();
    expect(contact.addresses).toHaveLength(1);
    expect(contact.addresses![0].street).toBe("My HOME");

    const updated = await client.contact.update({
      data: {
        id: contact.id,
        version: contact.version,
        addresses: {
          create: [
            {
              contact: {},
              street: "My OFFICE",
            },
          ],
          remove: contact.addresses![0].id,
        },
      },
      select: {
        addresses: {
          select: {
            street: true,
          },
        },
      },
    });

    expect(updated.addresses).toHaveLength(1);
    expect(updated.addresses![0].street).toBe("My OFFICE");
  });
});
