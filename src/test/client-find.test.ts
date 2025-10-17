import { describe, expect, it } from "vitest";
import { getTestClient } from "./client.utils";
import { Contact } from "./db/models";
import { createData } from "./fixture";

describe("client find tests", async () => {
  const client = await getTestClient();

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
      orderBy: {
        firstName: "DESC",
        title: {
          name: "ASC",
        },
        addresses: {
          city: "DESC",
          country: {
            name: "ASC",
          },
          contact: {
            lastName: "DESC",
          },
        },
      },
    });

    expect(res).toBeInstanceOf(Contact);
    expect(res!.id).toBeTruthy();
    expect(res!.title).toBeDefined();
    expect(res!.addresses).toBeDefined();
    expect(res!.addresses?.length).toBeGreaterThan(0);
  });

  it("should count", async () => {
    await createData(client);
    const titleCount = await client.title.count();
    expect(titleCount).toBe(3);
  });
});
