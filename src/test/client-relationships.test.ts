import { describe, expect, it } from "vitest";
import { getTestClient } from "./client.utils";

describe("client relationship tests", async () => {
  const client = await getTestClient();

  it("should handle bi-directional one-to-one", async () => {
    const c = await client.contact.create({
      data: {
        firstName: "Some",
        lastName: "Name",
        bio: {
          create: {
            contact: {},
            content: "It's Me!",
          },
        },
      },
      select: {
        firstName: true,
        lastName: true,
        bio: {
          content: true,
        },
      },
    });

    expect(c).toMatchObject({
      id: "1",
      version: 1,
      firstName: "Some",
      lastName: "Name",
      bio: { id: "1", version: 1, content: "It's Me!" },
    });

    const b = await client.bio.create({
      data: {
        content: "It's me again!",
        contact: {
          create: {
            firstName: "Some",
            lastName: "NAME",
          },
        },
      },
      select: {
        content: true,
        contact: {
          firstName: true,
          lastName: true,
        },
      },
    });

    expect(b).toMatchObject({
      id: "2",
      version: 1,
      content: "It's me again!",
      contact: {
        id: "2",
        version: 2,
        firstName: "Some",
        lastName: "NAME",
      },
    });
  });

  it("should handle bi-directional many-to-many", async () => {
    const client = await getTestClient();
    const res = await client.circle.create({
      data: {
        code: "friends",
        name: "Friends",
        contacts: {
          create: [
            {
              firstName: "Some",
              lastName: "Name",
            },
            {
              firstName: "Another",
              lastName: "Name",
            },
          ],
        },
      },
      select: {
        code: true,
        name: true,
        contacts: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    expect(res).toMatchObject({
      id: "1",
      version: 1,
      code: "friends",
      name: "Friends",
      contacts: [
        {
          id: "1",
          version: 1,
          firstName: "Some",
          lastName: "Name",
        },
        {
          id: "2",
          version: 1,
          firstName: "Another",
          lastName: "Name",
        },
      ],
    });
  });
});
