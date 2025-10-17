import { describe, expect, it } from "vitest";
import { BigDecimal } from "../client";
import { getTestClient } from "./client.utils";

describe("client BigDecimal tests", async () => {
  const client = await getTestClient();

  it("should handle BigDecimal operations", async () => {
    const country = await client.country.create({
      data: {
        code: "IN",
        name: "India",
        population: "138.50",
      },
    });

    expect(country.population).toBeDefined();
    expect(country.population).toBeInstanceOf(BigDecimal);
    expect(country.population!.toString()).toBe("138.50");

    const found = await client.country.findOne({
      where: { id: country.id },
      select: { population: true, code: true },
    });

    expect(found?.population?.toString()).toBe("138.50");
  });

  it("should perform BigDecimal arithmetic comparisons", async () => {
    await client.country.create({
      data: { code: "A1", name: "Test A", population: "10.25" },
    });
    await client.country.create({
      data: { code: "B1", name: "Test B", population: "20.50" },
    });
    await client.country.create({
      data: { code: "C1", name: "Test C", population: "15.75" },
    });

    const gtResults = await client.country.find({
      where: { population: { gt: "15.00" } },
      select: { code: true, population: true },
    });
    expect(gtResults).toHaveLength(2);
    expect(gtResults.map((r) => r.code)).toEqual(
      expect.arrayContaining(["B1", "C1"]),
    );

    const lteResults = await client.country.find({
      where: { population: { le: "15.75" } },
      select: { code: true, population: true },
    });
    expect(lteResults).toHaveLength(2);
    expect(lteResults.map((r) => r.code)).toEqual(
      expect.arrayContaining(["A1", "C1"]),
    );

    const betweenResults = await client.country.find({
      where: { population: { between: ["10.00", "16.00"] } },
      select: { code: true, population: true },
    });
    expect(betweenResults).toHaveLength(2);
    expect(betweenResults.map((r) => r.code)).toEqual(
      expect.arrayContaining(["A1", "C1"]),
    );
  });

  it("should handle BigDecimal precision and scale", async () => {
    const highPrecision = await client.country.create({
      data: {
        code: "HP",
        name: "High Precision",
        population: "123456789.123456789",
      },
    });

    expect(highPrecision.population?.toString()).toBe("123456789.123456789");

    const found = await client.country.findOne({
      where: { code: "HP" },
      select: { population: true },
    });

    expect(found?.population?.toString()).toBe("123456789.123456789");
  });

  it("should handle null and zero BigDecimal values", async () => {
    const nullPop = await client.country.create({
      data: {
        code: "NP",
        name: "Null Population",
        population: null,
      },
    });
    expect(nullPop.population).toBeNull();

    const zeroPop = await client.country.create({
      data: {
        code: "ZP",
        name: "Zero Population",
        population: "0",
      },
    });
    expect(zeroPop.population?.toString()).toBe("0");

    const zeroDecimal = await client.country.create({
      data: {
        code: "ZD",
        name: "Zero Decimal",
        population: "0.00",
      },
    });
    expect(zeroDecimal.population?.toString()).toBe("0.00");
  });

  it("should filter BigDecimal nulls and zeros", async () => {
    await client.country.create({
      data: { code: "N1", name: "Null", population: null },
    });
    await client.country.create({
      data: { code: "Z1", name: "Zero", population: "0" },
    });
    await client.country.create({
      data: { code: "P1", name: "Positive", population: "5.5" },
    });

    const nonNullResults = await client.country.find({
      where: { population: { ne: null } },
      select: { code: true },
    });
    expect(nonNullResults.map((r) => r.code)).toEqual(
      expect.arrayContaining(["Z1", "P1"]),
    );

    const gtZeroResults = await client.country.find({
      where: { population: { gt: "0" } },
      select: { code: true },
    });
    expect(gtZeroResults.map((r) => r.code)).toContain("P1");
    expect(gtZeroResults.map((r) => r.code)).not.toContain("Z1");
  });
});
