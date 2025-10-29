import { describe, expect, it } from "vitest";
import { getTestClient } from "./client.utils";

describe("client filtering tests", async () => {
  const client = await getTestClient();

  it("should filter record using 'NE' on boolean", async () => {
    const india = await client.country.create({
      data: {
        code: "IN",
        name: "India",
        isMember: true,
      },
    });

    const france = await client.country.create({
      data: {
        code: "FR",
        name: "France",
      },
    });

    const germany = await client.country.create({
      data: {
        code: "DE",
        name: "Germany",
      },
    });

    const memberCountries = await client.country.find({
      where: {
        isMember: {
          eq: true,
        },
      },
    });

    const nonMemberCountries = await client.country.find({
      where: {
        OR: [
          {
            isMember: { ne: true },
          },
          {
            isMember: { eq: null },
          },
        ],
      },
    });

    expect(memberCountries).toHaveLength(1);
    expect(nonMemberCountries).toHaveLength(2);
  });

  it("should filter decimal values", async () => {
    const US = await client.country.create({
      data: {
        code: "US",
        name: "United States",
        population: "33.23",
      },
    });
    const UK = await client.country.create({
      data: {
        code: "UK",
        name: "United Kingdom",
        population: "6.80",
      },
    });
    const CN = await client.country.create({
      data: {
        code: "CN",
        name: "China",
        population: "140.56",
      },
    });
    const found = await client.country.find({
      select: {
        code: true,
      },
      where: {
        population: {
          gt: "30",
        },
      },
    });
    expect(found).toHaveLength(2);
    expect(found.map((x) => x.code)).toContain("US");
    expect(found.map((x) => x.code)).toContain("CN");
  });
});
