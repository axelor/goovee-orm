import { faker } from "@faker-js/faker";
import { TestClient } from "./client.utils";

const createDateOfBirth = (age: number) => {
  const date = new Date();
  const dob = new Date(
    date.getFullYear() - age,
    date.getMonth(),
    date.getDate()
  );
  return dob.toISOString();
};

const createTitles = async (client: TestClient) => {
  await client.title.create({
    data: {
      code: "mr",
      name: "Mr.",
    },
  });
  await client.title.create({
    data: {
      code: "mrs",
      name: "Mrs.",
    },
  });
};

const createCountries = async (client: TestClient) => {
  await client.country.create({
    data: {
      code: "fr",
      name: "France",
    },
  });
  await client.country.create({
    data: {
      code: "de",
      name: "Germany",
    },
  });
  await client.country.create({
    data: {
      code: "ca",
      name: "Canada",
    },
  });
  await client.country.create({
    data: {
      code: "us",
      name: "United States",
    },
  });
  await client.country.create({
    data: {
      code: "uk",
      name: "United Kingdom",
    },
  });
  await client.country.create({
    data: {
      code: "es",
      name: "Spain",
    },
  });
  await client.country.create({
    data: {
      code: "in",
      name: "India",
    },
  });
  await client.country.create({
    data: {
      code: "cn",
      name: "China",
    },
  });
};

const createCircles = async (client: TestClient) => {
  await client.circle.create({
    data: {
      code: "family",
      name: "Family",
    },
  });
  await client.circle.create({
    data: {
      code: "friends",
      name: "Friends",
    },
  });
};

const createContact = async (client: TestClient) => {
  const firstName = faker.name.firstName();
  const lastName = faker.name.lastName();
  const nick = faker.hacker.noun();
  const dob = faker.date.birthdate({ min: 18, max: 65, mode: "age" });
  const age = new Date().getFullYear() - dob.getFullYear();
  const customer = faker.helpers.arrayElement([true, false]);
  const salary = faker.finance.amount();

  const title = faker.helpers.arrayElement(["mr", "mrs"]);
  const country = faker.helpers.arrayElement([
    "fr",
    "de",
    "es",
    "uk",
    "us",
    "ca",
    "in",
  ]);
  const circle = faker.helpers.arrayElement(["friends", "family"]);

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
      title: {
        select: {
          code: title,
        },
      },
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
            country: {
              select: {
                code: country,
              },
            },
            props: Promise.resolve({
              altContact,
            }),
          },
        ],
      },
      circles: {
        select: [
          {
            code: circle,
          },
        ],
      },
    },
    select: {
      attrs: true,
    },
  });
};

export const createData = async (client: TestClient, count: number = 20) => {
  await createTitles(client);
  await createCountries(client);
  await createCircles(client);
  for (let n = 0; n < count; n++) {
    await createContact(client);
  }
};
