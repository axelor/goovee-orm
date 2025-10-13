# Goovee ORM

Goovee ORM is an ORM based on [TypeORM](https://typeorm.io) to match the context of [Axelor Open Suite](https://github.com/axelor/axelor-open-suite) for use within the [Goovee Portal](https://github.com/axelor/goovee) project.

It simplifies entity management and database access by aligning TypeORM's powerful features with Axelor's business data model and architecture.

## Installation

### Stable Release

Install the latest stable version:

```bash
npm install @goovee/orm
# or
pnpm install @goovee/orm
```

### Development Release

To use the latest development version from the `dev` branch with the newest features:

```bash
npm install @goovee/orm@next
# or
pnpm install @goovee/orm@next
```

Development versions follow the format `0.0.6-next.20251013142530.abc123f` where:
- `20251013142530` is the build timestamp
- `abc123f` is the commit SHA for traceability

You can also install a specific development version:

```bash
pnpm install @goovee/orm@0.0.6-next.20251013142530.abc123f
```

## Usage

### Schemas definition

Once the package is installed, you can create json files to describe data objects structure inside a `goovee/schema` folder. Each object should have its own file.

Here is an example of schema:

```json
{
  "name": "User",
  "table": "auth_user",
  "extends": "Model",
  "synchronize": false,
  "fields": [
    {
      "type": "String",
      "name": "name"
    },
    {
      "type": "String",
      "name": "fullName"
    },
    {
      "name": "partner",
      "type": "OneToOne",
      "target": "Partner"
    }
  ]
}
```

Then you can generate ORM config using: `npx goovee generate`. Once executed, this CLI will generate a class for each model defined in the project with the fields defined. It will also generate the global client of the application which should be used to access data. All generated code will be in the folder goovee/.generated.

Then, you need to create a client getter function. This should be done once in the project in an index file at the root of goovee folder to be used later for data access or modification in the application.

```javascript
import { GooveeClient, createClient } from "./.generated/client";

let client: GooveeClient;

export async function getClient() {
  if (client === undefined) {
	client = createClient({
        url: "postgres://user:pwd@localhost:5432/db-name",
    });
	await client.$connect();
	await client.$sync();
  }
  return client;
}
```

This client will contain all the models defined earlier as a type object where each field will be the name of the model with first letter in lowercase. So for example, to access client of the MetaJsonModel model, it will be: client.metaJsonModel.

### Use client

Once the client is generated, you can use it like that:

```javascript
import {getClient} from "@/goovee";

export async function findUser({ name }: { name: string }) {
  const client = await getClient();

  const model = await client.user.findOne({
    where: { name },
    select: {id: true, name: true},
  });
}
```

This client provides several functions for querying the database :

- `find`: to search through objects in the database with criterias
- `findOne`: to search through objects in the database with criterias and take the first result
- `create`: create a new record in the database
- `update`: update an existing record in the database
- `delete`: delete a record in the database
- `count`: count all records in the database or records meeting certain conditions
- `updateAll`: update all records in the database with the given values
- `deleteAll`: delete all records in the database or records meeting certain conditions

## License

This package is made available under the Sustainable Use License.

You may use this software for non-commercial or internal business purposes only.
Commercial use requires a valid Axelor SAS Enterprise License.

See [LICENSE.md](https://github.com/axelor/goovee-orm/blob/main/LICENSE.md) for details.

## Development

Please check out our [CONTRIBUTING.md](https://github.com/axelor/goovee-orm/blob/main/CONTRIBUTING.md) for guidelines.

### Requirements

- `node >= 18.0.0`
- `pnpm >= 9.0.6`

You can use [corepack](https://nodejs.org/api/corepack.html) to install [pnpm](https://pnpm.io/installation).

```
corepack enable
corepack prepare pnpm@latest --activate
```

### Important commands

- Build package : `pnpm build`
- Start watch mode : `pnpm dev`
- Run tests : `pnpm test`
