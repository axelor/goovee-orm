import { describe, expect, it } from "vitest";
import { getTestClient } from "./client.utils";
import { AddressType } from "./db/models";

describe("client create tests", async () => {
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
    expect(res).toHaveProperty("code", undefined);
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
});
