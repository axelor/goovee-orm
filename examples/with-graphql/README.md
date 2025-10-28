# Goovee ORM with GraphQL Yoga

This example shows how to use [Goovee ORM](https://github.com/axelor/goovee-orm) with [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server).

## Getting Started

First, enable [pnpm](https://pnpm.io/):

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

Generate Goovee client:

```bash
pnpm goovee generate
```

This command will generate goovee client for the defined schema.

Set `DATABASE_URL` environment:

```bash
DATABASE_URL=postgresql://username:password@localhost:5432/goovee-graphql
```

by either editing `.env` or export in the shell.

Seed the database (optional):

```bash
pnpm seed
```

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:4000/graphql](http://localhost:4000/graphql) with your browser to access the GraphiQL playground.
