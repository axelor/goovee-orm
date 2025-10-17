import { describe, expect, it } from "vitest";
import { getTestClient } from "./client.utils";

describe("client LOB (text, json, binary) tests", async () => {
  const client = await getTestClient();

  it("should handle text, json and binary fields", async () => {
    // when working with binary fields, always use transaction
    await client.$transaction(async (c) => {
      const res = await c.contact.create({
        data: {
          firstName: "some",
          lastName: "name",
          attrs: Promise.resolve({
            some: "name",
            thing: [1, 2, 3],
          }),
          notes: Promise.resolve("Some Notes"),
          image: Promise.resolve(Buffer.from("Hello!!!", "ascii")),
        },
        select: {
          attrs: true,
          notes: true,
          image: true,
        },
      });

      expect(res.image).toBeInstanceOf(Promise);
      expect(res.notes).toBeInstanceOf(Promise);
      expect(res.attrs).toBeInstanceOf(Promise);
      expect((await res.image)?.toString()).toBe("Hello!!!");
      expect(await res.notes).toBe("Some Notes");
      expect(await res.attrs).toMatchObject({
        some: "name",
        thing: [1, 2, 3],
      });
    });
  });
});
