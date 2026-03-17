import { describe, expect, it, vi } from "vitest";
import { EntityRepository } from "./repository";
import { Interceptor } from "./middleware";

describe("EntityRepository protected field guards", () => {
  const makeRepo = () =>
    ({
      metadata: {
        name: "Thing",
        findRelationWithPropertyPath: () => null,
      },
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
    }) as any;

  const makeClient = () =>
    ({
      __schema: [
        {
          name: "Thing",
          fields: [
            { name: "secret", type: "String", internal: true },
            { name: "auditStamp", type: "DateTime", readonly: true },
          ],
        },
      ],
    }) as any;

  it("rejects internal fields on create", async () => {
    const repo = new EntityRepository(
      makeRepo(),
      makeClient(),
      new Interceptor(),
    );

    await expect(
      repo.create({
        data: {
          name: "visible",
          secret: "hidden",
        },
      } as any),
    ).rejects.toThrow("Field 'secret' on Thing is protected");
  });

  it("rejects readonly fields on update", async () => {
    const repo = new EntityRepository(
      makeRepo(),
      makeClient(),
      new Interceptor(),
    );

    await expect(
      repo.update({
        data: {
          id: 1,
          version: 1,
          auditStamp: new Date(),
        },
      } as any),
    ).rejects.toThrow("Field 'auditStamp' on Thing is protected");
  });
});
