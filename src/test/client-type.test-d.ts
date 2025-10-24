import { describe, it, expectTypeOf } from "vitest";
import { getTestClient } from "./client.utils";
import { CreateArgs } from "../client";
import { Contact } from "./db/models";

describe("client type tests", async () => {
  const client = await getTestClient();

  it("should have correct types for date, time, and datetime fields", async () => {
    const contactData: CreateArgs<Contact> = {
      firstName: "Type",
      lastName: "Test",
      dateOfBirth: new Date("2023-01-01"),
      timeOfBirth: "10:30:00",
      registeredOn: new Date(),
    };

    expectTypeOf(contactData.dateOfBirth).toEqualTypeOf<
      Date | null | undefined
    >();
    expectTypeOf(contactData.timeOfBirth).toEqualTypeOf<
      string | null | undefined
    >();
    expectTypeOf(contactData.registeredOn).toEqualTypeOf<
      Date | null | undefined
    >();

    const contact = await client.contact.create({ data: contactData });

    expectTypeOf(contact.dateOfBirth).toEqualTypeOf<Date | undefined>();
    expectTypeOf(contact.timeOfBirth).toEqualTypeOf<string | undefined>();
    expectTypeOf(contact.registeredOn).toEqualTypeOf<Date | undefined>();
  });

  it("should have correct type for toMany field with orderBy", async () => {
    const contact = await client.contact.findOne({
      select: {
        addresses: { select: { street: true }, orderBy: { street: "ASC" } },
      },
    });

    if (contact?.addresses) {
      expectTypeOf(contact.addresses).toBeArray();
      expectTypeOf(contact.addresses[0].street).toBeString();
    }
  });
});
