import "@/load-env";

import { getClient } from "@/goovee";
import { Client } from "@/goovee/db/client";

async function seed(client: Client) {
  // Check if data already exists
  const existingAuthors = await client.author.count();
  if (existingAuthors > "0") {
    console.log("Data already seeded. Exiting.");
    return;
  }

  // Seed Authors
  const author1 = await client.author.create({
    data: {
      name: "John Doe",
      email: "john.doe@example.com",
      bio: "John is a software engineer passionate about web technologies and open source. He loves writing about JavaScript, TypeScript, and modern frameworks.",
      website: "https://johndoe.dev",
      joinedOn: "2020-01-15",
    },
  });

  const author2 = await client.author.create({
    data: {
      name: "Jane Smith",
      email: "jane.smith@example.com",
      bio: "Jane is a full-stack developer with expertise in React, Node.js, and database design. She enjoys teaching and sharing knowledge with the developer community.",
      website: "https://janesmith.com",
      joinedOn: "2021-06-22",
    },
  });

  // Seed Posts
  await client.post.create({
    data: {
      title: "First Post",
      slug: "first-post",
      content: Promise.resolve("This is the content of the first post."),
      publishedOn: new Date("2020-02-01T14:30:00"),
      author: {
        select: { id: author1.id },
      },
    },
  });

  await client.post.create({
    data: {
      title: "Second Post",
      slug: "second-post",
      content: Promise.resolve("This is the content of the second post."),
      publishedOn: new Date("2021-07-10T09:15:00"),
      author: {
        select: { id: author2.id },
      },
    },
  });

  console.log("Seeding completed.");
}

async function main() {
  const client = await getClient();
  try {
    await client.$transaction(seed);
  } catch (error) {
    console.error("Error during seeding:", error);
    process.exit(1);
  } finally {
    await client.$disconnect();
  }
}

main();
