import { describe, expect, it } from "vitest";
import { getTestClient, TestClient } from "./client.utils";
import { AddressType, Contact } from "./entity";

const createData = async (client: TestClient) => {
  await client.title.create({
    data: {
      code: "mr",
      name: "Mr.",
    },
  });

  await client.title.create({
    data: {
      code: "mrs",
      name: "Mrs.",
    },
  });

  await client.country.create({
    data: {
      code: "fr",
      name: "France",
    },
  });

  await client.contact.create({
    data: {
      firstName: "Some",
      lastName: "Name",
      title: {
        select: {
          code: "mr",
        },
      },
      addresses: {
        create: [
          {
            contact: {},
            street: "My Home",
          },
        ],
      },
    },
  });

  await client.address.create({
    data: {
      street: "My Office",
      contact: {
        select: {
          firstName: "Some",
          lastName: "Name",
        },
      },
    },
  });
};

describe("client tests", async () => {
  const client = await getTestClient();
  it("should create a record", async () => {
    const res = await client.title.create({
      data: {
        code: "mr",
        name: "Mr.",
      },
    });
    expect(res).toMatchObject({
      id: "1",
      version: 1,
      code: "mr",
      name: "Mr.",
    });
  });

  it("should create a record and return selected fields", async () => {
    const res = await client.title.create({
      data: {
        code: "mr",
        name: "Mr.",
      },
      select: {
        name: true,
      },
    });
    expect(res).toMatchObject({
      id: "1",
      version: 1,
      name: "Mr.",
    });
    expect(res).not.toHaveProperty("code");
  });

  it("should create record with nested records", async () => {
    const res = await client.contact.create({
      data: {
        firstName: "Some",
        lastName: "NAME",
        title: {
          create: {
            code: "mr",
            name: "Mr.",
          },
        },
        addresses: {
          create: [
            {
              contact: {},
              street: "My HOME",
              type: AddressType.Home,
            },
            {
              contact: {},
              street: "My Office",
              type: AddressType.Office,
            },
          ],
        },
        circles: {
          create: [
            {
              code: "family",
              name: "Family",
            },
            {
              code: "friemds",
              name: "Friends",
            },
          ],
        },
      },
      select: {
        firstName: true,
        lastName: true,
        title: {
          code: true,
          name: true,
        },
        addresses: {
          select: {
            type: true,
            street: true,
          },
        },
        circles: {
          select: {
            name: true,
          },
        },
      },
    });

    const x = await client.address.find({
      select: {
        id: true,
        contact: {
          id: true,
        },
      },
    });

    expect(res).toMatchObject({
      id: "1",
      version: 1,
      firstName: "Some",
      lastName: "NAME",
      title: {
        id: "1",
        version: 1,
        code: "mr",
        name: "Mr.",
      },
      addresses: [
        {
          id: "1",
          version: 1,
          type: "home",
          street: "My HOME",
        },
        {
          id: "2",
          version: 1,
          type: "office",
          street: "My Office",
        },
      ],
      circles: [
        {
          id: "1",
          version: 1,
          name: "Family",
        },
        {
          id: "2",
          version: 1,
          name: "Friends",
        },
      ],
    });
  });

  it("should create record and select references", async () => {
    await client.title.create({
      data: {
        code: "mr",
        name: "Mr.",
      },
    });
    await client.circle.create({
      data: {
        code: "family",
        name: "Family",
      },
    });
    const res = await client.contact.create({
      data: {
        firstName: "Some",
        lastName: "NAME",
        title: {
          select: {
            code: "mr",
          },
        },
        circles: {
          select: [
            {
              code: "family",
            },
          ],
        },
      },
      select: {
        firstName: true,
        lastName: true,
        title: {
          code: true,
          name: true,
        },
        circles: {
          select: {
            name: true,
          },
        },
      },
    });
    expect(res).toMatchObject({
      id: "1",
      version: 1,
      firstName: "Some",
      lastName: "NAME",
      title: {
        id: "1",
        version: 1,
        code: "mr",
        name: "Mr.",
      },
      circles: [
        {
          id: "1",
          version: 1,
          name: "Family",
        },
      ],
    });
  });

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

  it("should find", async () => {
    await createData(client);
    const res = await client.contact.findOne({
      select: {
        firstName: true,
        lastName: true,
        title: {
          name: true,
        },
        fullName: true,
        addresses: {
          select: {
            street: true,
          },
        },
      },
      where: {
        id: 1,
      },
    });

    expect(res).toBeInstanceOf(Contact);
    expect(res.id).toBeTruthy();
    expect(res.fullName).toBe("Mr. Some Name");
    expect(res.title).toBeDefined();
    expect(res.addresses).toHaveLength(2);
  });

  it("should count", async () => {
    await createData(client);
    const titleCount = await client.title.count();
    expect(titleCount).toBe(2);
  });

  it("should bulk update", async () => {
    await createData(client);
    const bulkUpdated = await client.contact.updateAll({
      set: {
        lastName: "NAME",
        title: {
          id: null,
        },
      },
    });

    expect(bulkUpdated).toBe(1);

    const afterBulkUpdate = await client.contact.findOne({
      select: {
        lastName: true,
        title: {
          id: true,
        },
      },
      where: { id: 1 },
    });

    expect(afterBulkUpdate).toBeDefined();
    expect(afterBulkUpdate.lastName).toBe("NAME");
    expect(afterBulkUpdate.title).toBeNull();
  });

  it("should bulk delete", async () => {
    await createData(client);
    const bulkDeleted = await client.title.deleteAll({
      where: {
        code: "mrs",
      },
    });
    expect(bulkDeleted).toBe(1);
  });
});
