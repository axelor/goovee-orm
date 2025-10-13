import { describe, expect, it } from "vitest";
import { getTestClient } from "./client.utils";

describe("ambiguous column test", async () => {
  const client = await getTestClient();

  it("should not cause ambiguous column error", async () => {
    await client.contact.create({
      data: {
        firstName: "Some",
        lastName: "NAME",
        circles: {
          create: [
            {
              code: "friemds",
              name: "Friends",
            },
          ],
        },
      },
    });

    const res = client.contact.find({
      where: { circles: { name: { ne: null } } },
      orderBy: { fullName: "DESC" },
      take: 7,
    });

    expect(res).resolves.toBeTruthy();
  });
});
