import { createYoga } from "graphql-yoga";
import { createServer } from "node:http";
import { getClient, getSchema } from "@/goovee";

async function main() {
  const client = await getClient();
  const schema = getSchema();

  const yoga = createYoga({
    schema,
    context: { client },
    graphiql: true,
  });

  const server = createServer(yoga);

  const port = process.env.PORT || 4000;

  server.listen(port, () => {
    console.log(`Server ready at http://localhost:${port}/graphql`);
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down gracefully...");
    await client.$disconnect();
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
