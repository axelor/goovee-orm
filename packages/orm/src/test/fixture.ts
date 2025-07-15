import { TestClient } from "./client.utils";
import { titles, circles, countries, contacts } from "./fixture-data";

const createDateOfBirth = (age: number) => {
  const date = new Date();
  const dob = new Date(
    date.getFullYear() - age,
    date.getMonth(),
    date.getDate(),
  );
  return dob.toISOString();
};

const createTitles = async (client: TestClient) => {
  for (const title of titles) {
    await client.title.create({
      data: title,
    });
  }
};

const createCountries = async (client: TestClient) => {
  for (const country of countries) {
    await client.country.create({
      data: country,
    });
  }
};

const createCircles = async (client: TestClient) => {
  for (const circle of circles) {
    await client.circle.create({
      data: circle,
    });
  }
};

const createContact = async (client: TestClient, contactData: typeof contacts[0]) => {
  const {
    firstName,
    lastName,
    nick,
    age,
    customer,
    salary,
    title,
    country,
    circle,
    expertSkill,
    skills,
    tags,
    street,
    city,
    altContact,
    bioContent,
  } = contactData;

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

export const createData = async (client: TestClient) => {
  await createTitles(client);
  await createCountries(client);
  await createCircles(client);
  for (const contactData of contacts) {
    await createContact(client, contactData);
  }
};

export const clearData = async (client: TestClient) => {
  // Delete in reverse order of creation to handle foreign key constraints
  await client.contact.deleteAll();
  await client.circle.deleteAll();
  await client.country.deleteAll();
  await client.title.deleteAll();
};
