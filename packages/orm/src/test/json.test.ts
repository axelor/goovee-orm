import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it } from "vitest";
import { getTestClient } from "./client.utils";

describe("json tests", async () => {
  const client = await getTestClient();

  const createDateOfBirth = (age: number) => {
    const date = new Date();
    const dob = new Date(
      date.getFullYear() - age,
      date.getMonth(),
      date.getDate(),
    );
    return dob.toISOString();
  };

  const createContact = async () => {
    const firstName = faker.name.firstName();
    const lastName = faker.name.lastName();
    const nick = faker.hacker.noun();
    const dob = faker.date.birthdate({ min: 18, max: 65, mode: "age" });
    const age = new Date().getFullYear() - dob.getFullYear();
    const customer = faker.helpers.arrayElement([true, false]);
    const salary = faker.finance.amount();

    const expertSkill = faker.helpers.arrayElement([
      "Java",
      "TypeScript",
      "React",
      "Next.js",
      "Hibernate",
      "PostgreSQL",
    ]);

    const skills = faker.helpers.arrayElements([
      "Java",
      "JavaScript",
      "TypeScript",
      "React",
      "Next.js",
      "Hibernate",
      "PostgreSQL",
      "MySQL",
      "Database",
      "Git",
      "Linux",
    ]);

    const tags = faker.helpers.arrayElements([
      { id: 1, color: "red", name: "Red" },
      { id: 2, color: "blue", name: "Blue" },
      { id: 3, color: "green", name: "Green" },
      { id: 4, color: "yellow", name: "Yellow" },
    ]);

    const street = faker.address.street();
    const city = faker.address.city();
    const altContact = faker.name.fullName();

    const bioContent = faker.lorem.text();

    return await client.contact.create({
      data: {
        firstName,
        lastName,
        attrs: Promise.resolve({
          nick,
          age,
          customer,
          salary,
          tags,
          dateOfBirth: createDateOfBirth(age),
        }),
        bio: {
          create: {
            content: bioContent,
            me: Promise.resolve({
              expertSkill,
              skills,
              age,
            }),
          },
        },
        addresses: {
          create: [
            {
              contact: {},
              street,
              city,
              props: Promise.resolve({
                altContact,
              }),
            },
          ],
        },
      },
      select: {
        attrs: true,
      },
    });
  };

  beforeEach(async () => {
    let max = 20;
    while (max-- > 0) {
      await createContact();
    }
  });

  it("should search on text json field", async () => {
    const res = await client.contact.find({
      where: {
        OR: [
          { attrs: { path: "nick", like: "a%" } },
          { attrs: { path: "nick", like: "%s%" } },
        ],
      },
      select: {
        attrs: true,
      },
    });

    const data = await Promise.all(res.map((x) => x.attrs));
    const nicks = data.map((x: any) => x.nick);
    const matched = nicks.every((x) => x.startsWith("a") || x.includes("s"));
    expect(matched).toBeTruthy();
  });

  it("should search on numeric json field", async () => {
    const res = await client.contact.find({
      where: {
        AND: [
          { attrs: { path: "age", ge: 30 } },
          { attrs: { path: "age", lt: 50 } },
        ],
      },
      select: {
        attrs: true,
      },
    });

    const data = await Promise.all(res.map((x) => x.attrs));
    const nums = data.map((x: any) => x.age);

    expect(Math.min(...nums)).toBeGreaterThanOrEqual(30);
    expect(Math.max(...nums)).toBeLessThan(50);
  });

  it("should search on boolean json field", async () => {
    const res = await client.contact.find({
      where: {
        attrs: { path: "customer", eq: true },
      },
      select: {
        attrs: true,
      },
    });

    const data = await Promise.all(res.map((x) => x.attrs));
    const matched = data.every((x: any) => x.customer === true);
    expect(matched).toBeTruthy();
  });

  it("should search on decimal json field", async () => {
    const res = await client.contact.find({
      where: {
        attrs: { path: "salary", between: ["100.00", "300.00"] },
      },
      select: {
        attrs: true,
      },
    });

    const data = await Promise.all(res.map((x) => x.attrs));
    const vals = data.map((x: any) => parseFloat(x.salary));

    expect(Math.min(...vals)).greaterThanOrEqual(100);
    expect(Math.max(...vals)).lessThanOrEqual(300);
  });

  it("should search on date json field", async () => {
    const upper = await client.contact.findOne({
      where: {
        attrs: { path: "age", ge: 40 },
      },
      select: {
        attrs: true,
      },
    });

    const lower = await client.contact.findOne({
      where: {
        attrs: { path: "age", le: 30 },
      },
      select: {
        attrs: true,
      },
    });

    expect(upper).toBeDefined();
    expect(lower).toBeDefined();

    if (upper?.attrs && lower?.attrs) {
      const upperDate = (await upper.attrs).dateOfBirth as string;
      const lowerDate = (await lower.attrs).dateOfBirth as string;

      const res = await client.contact.find({
        where: {
          attrs: { path: "dateOfBirth", between: [upperDate, lowerDate] },
        },
        select: {
          attrs: true,
        },
      });

      const data = await Promise.all(res.map((x: any) => x.attrs));
      const dates = data.map((x: any) => x.dateOfBirth).map((x) => new Date(x));

      const uDate = new Date(upperDate);
      const lDate = new Date(lowerDate);

      expect(dates.every((x) => x >= uDate)).toBeTruthy();
      expect(dates.every((x) => x <= lDate)).toBeTruthy();
    }
  });

  it("should search on array json field", async () => {
    const res = await client.contact.find({
      where: {
        attrs: { path: "tags[*].color", eq: "red" },
      },
      select: {
        attrs: true,
      },
    });

    const data = await Promise.all(res.map((x) => x.attrs));
    const tags = data.map((x: any) => x.tags);

    const matched = tags.every((x) => x.some((t: any) => t.color === "red"));
    expect(matched).toBeTruthy();
  });

  it("should order on json field", async () => {
    const res = await client.contact.find({
      select: {
        attrs: true,
      },
      orderBy: {
        attrs: [{ path: "age", order: "DESC" }],
      },
    });

    const data = await Promise.all(res.map((x) => x.attrs));
    const vals = data.map((x: any) => x.age);

    const max = vals[0];
    const min = vals[vals.length - 1];

    expect(Math.min(...vals)).toBe(min);
    expect(Math.max(...vals)).toBe(max);
  });
});
