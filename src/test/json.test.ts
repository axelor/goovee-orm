import { beforeEach, describe, expect, it } from "vitest";
import { BigDecimal } from "../client";
import { getTestClient } from "./client.utils";
import { createData, clearData } from "./fixture";

describe("json tests", async () => {
  const client = await getTestClient();

  beforeEach(async () => {
    await clearData(client);
    await createData(client);
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

describe("json filter tests", async () => {
  const client = await getTestClient();

  describe("Decimal comparisons in JSON", () => {
    const low = "10.00";
    const exact = "50.00";
    const high = "90.00";

    beforeEach(async () => {
      await client.contact.create({
        data: {
          firstName: "Decimal",
          lastName: "Test",
          attrs: Promise.resolve({ salary: exact }),
        },
        select: { id: true },
      });
    });

    const findBySalary = (salary: any) =>
      client.contact.find({
        where: { attrs: { path: "salary", ...salary, type: "Decimal" } },
        select: { id: true },
      });

    it("eq", async () => {
      expect(await findBySalary({ eq: exact })).toHaveLength(1);
      expect(await findBySalary({ eq: high })).toHaveLength(0);
    });

    it("infers Decimal from BigDecimal values", async () => {
      const res = await client.contact.find({
        where: {
          attrs: { path: "salary", eq: new BigDecimal(exact) },
        },
        select: { id: true },
      });

      expect(res).toHaveLength(1);
    });

    it("ne", async () => {
      expect(await findBySalary({ ne: high })).toHaveLength(1);
      expect(await findBySalary({ ne: exact })).toHaveLength(0);
    });

    it("gt", async () => {
      expect(await findBySalary({ gt: low })).toHaveLength(1);
      expect(await findBySalary({ gt: high })).toHaveLength(0);
      expect(await findBySalary({ gt: exact })).toHaveLength(0);
    });

    it("ge", async () => {
      expect(await findBySalary({ ge: exact })).toHaveLength(1);
      expect(await findBySalary({ ge: low })).toHaveLength(1);
      expect(await findBySalary({ ge: high })).toHaveLength(0);
    });

    it("lt", async () => {
      expect(await findBySalary({ lt: high })).toHaveLength(1);
      expect(await findBySalary({ lt: low })).toHaveLength(0);
      expect(await findBySalary({ lt: exact })).toHaveLength(0);
    });

    it("le", async () => {
      expect(await findBySalary({ le: exact })).toHaveLength(1);
      expect(await findBySalary({ le: high })).toHaveLength(1);
      expect(await findBySalary({ le: low })).toHaveLength(0);
    });

    it("in", async () => {
      expect(await findBySalary({ in: [low, exact, high] })).toHaveLength(1);
      expect(await findBySalary({ in: [low, high] })).toHaveLength(0);
    });

    it("notIn", async () => {
      expect(await findBySalary({ notIn: [low, high] })).toHaveLength(1);
      expect(await findBySalary({ notIn: [low, exact, high] })).toHaveLength(0);
    });

    it("between", async () => {
      expect(await findBySalary({ between: [low, high] })).toHaveLength(1);
      expect(await findBySalary({ between: [exact, exact] })).toHaveLength(1);
      expect(await findBySalary({ between: [high, high] })).toHaveLength(0);
    });

    it("notBetween", async () => {
      expect(await findBySalary({ notBetween: [high, high] })).toHaveLength(1);
      expect(await findBySalary({ notBetween: [low, high] })).toHaveLength(0);
    });
  });

  describe("Date comparisons in JSON", () => {
    const past = "2020-01-01";
    const exact = "2020-01-02";
    const future = "2020-01-03";

    beforeEach(async () => {
      await client.contact.create({
        data: {
          firstName: "Date",
          lastName: "Test",
          attrs: Promise.resolve({ createdAt: exact }),
        },
        select: { id: true },
      });
    });

    const findByDate = (createdAt: object) =>
      client.contact.find({
        where: { attrs: { path: "createdAt", ...createdAt, type: "Date" } },
        select: { id: true },
      });

    it("eq", async () => {
      expect(await findByDate({ eq: exact })).toHaveLength(1);
      expect(await findByDate({ eq: future })).toHaveLength(0);
    });

    it("ne", async () => {
      expect(await findByDate({ ne: future })).toHaveLength(1);
      expect(await findByDate({ ne: exact })).toHaveLength(0);
    });

    it("gt", async () => {
      expect(await findByDate({ gt: past })).toHaveLength(1);
      expect(await findByDate({ gt: future })).toHaveLength(0);
      expect(await findByDate({ gt: exact })).toHaveLength(0);
    });

    it("ge", async () => {
      expect(await findByDate({ ge: exact })).toHaveLength(1);
      expect(await findByDate({ ge: past })).toHaveLength(1);
      expect(await findByDate({ ge: future })).toHaveLength(0);
    });

    it("lt", async () => {
      expect(await findByDate({ lt: future })).toHaveLength(1);
      expect(await findByDate({ lt: past })).toHaveLength(0);
      expect(await findByDate({ lt: exact })).toHaveLength(0);
    });

    it("le", async () => {
      expect(await findByDate({ le: exact })).toHaveLength(1);
      expect(await findByDate({ le: future })).toHaveLength(1);
      expect(await findByDate({ le: past })).toHaveLength(0);
    });

    it("in", async () => {
      expect(await findByDate({ in: [past, exact, future] })).toHaveLength(1);
      expect(await findByDate({ in: [past, future] })).toHaveLength(0);
    });

    it("notIn", async () => {
      expect(await findByDate({ notIn: [past, future] })).toHaveLength(1);
      expect(await findByDate({ notIn: [past, exact, future] })).toHaveLength(
        0,
      );
    });

    it("between", async () => {
      expect(await findByDate({ between: [past, future] })).toHaveLength(1);
      expect(await findByDate({ between: [exact, exact] })).toHaveLength(1);
      expect(await findByDate({ between: [future, future] })).toHaveLength(0);
    });

    it("notBetween", async () => {
      expect(await findByDate({ notBetween: [future, future] })).toHaveLength(
        1,
      );
      expect(await findByDate({ notBetween: [past, future] })).toHaveLength(0);
    });
  });
});
