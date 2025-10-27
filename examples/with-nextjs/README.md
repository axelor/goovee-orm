# Goovee ORM Starter (Next.js)

This example shows how to use [Goovee ORM](https://github.com/axelor/goovee-orm) in a [Next.js](https://nextjs.org/) project.

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
DATABASE_URL=postgresql://username:password@localhost:5432/goovee-starter
```

by either editing `.env` or export in the shell.

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
