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
      "name": "name",
      "size": 255
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

#### Field Types

The ORM supports various field types:

**Basic Types:**
- `String` - Text field with optional size limit
- `Text` - Large text field (stored as LOB)
- `Boolean` - True/false values
- `Int` / `BigInt` - Integer numbers
- `Decimal` - High-precision decimal numbers (uses BigDecimal)
- `Date` - Date only (YYYY-MM-DD)
- `Time` - Time only
- `DateTime` - Date and time

**Special Types:**
- `JSON` - JSON objects (stored as LOB)
- `Binary` - Binary data (stored as LOB)
- `Enum` - Enumeration with predefined values

**Relationship Types:**
- `ManyToOne` - Many-to-one relationship
- `OneToMany` - One-to-many relationship
- `OneToOne` - One-to-one relationship
- `ManyToMany` - Many-to-many relationship

#### Schema Options

Common field options:
- `required`: Make field mandatory
- `unique`: Ensure unique values
- `default`: Default value
- `readonly`: Read-only field
- `hidden`: Hidden from queries
- `index`: Create database index
- `nullable`: Allow null values

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

### Client API

The client provides several methods for database operations:

#### Query Methods
- `find` - Search through records with criteria
- `findOne` - Find first record matching criteria
- `count` - Count records matching criteria
- `aggregate` - Perform aggregations (count, sum, avg, min, max)

#### Mutation Methods
- `create` - Create a new record
- `update` - Update an existing record
- `delete` - Delete a record
- `updateAll` - Bulk update records
- `deleteAll` - Bulk delete records

#### Transaction Methods
- `$transaction` - Execute operations within a transaction

### Basic Queries

#### Finding Records

```javascript
import {getClient} from "@/goovee";

// Find all users
const users = await client.user.find();

// Find with conditions
const activeUsers = await client.user.find({
  where: {
    status: "active",
    age: { gt: 18 }
  }
});

// Find with specific fields
const users = await client.user.find({
  select: {
    id: true,
    name: true,
    email: true
  }
});

// Find one record
const user = await client.user.findOne({
  where: { email: "user@example.com" }
});
```

#### Creating Records

```javascript
// Simple create
const user = await client.user.create({
  data: {
    name: "John Doe",
    email: "john@example.com"
  }
});

// Create with relationships
const contact = await client.contact.create({
  data: {
    firstName: "Jane",
    lastName: "Doe",
    title: {
      create: {
        code: "ms",
        name: "Ms."
      }
    },
    addresses: {
      create: [
        {
          contact: {},
          street: "123 Main St",
          city: "New York"
        }
      ]
    }
  }
});

// Create and link to existing record
const contact = await client.contact.create({
  data: {
    firstName: "John",
    lastName: "Smith",
    title: {
      select: { id: existingTitleId }
    }
  }
});
```

#### Updating Records

```javascript
// Update a record
const updated = await client.user.update({
  data: {
    id: user.id,
    version: user.version,
    name: "Jane Doe"
  }
});

// Update with nested relationships
const updated = await client.contact.update({
  data: {
    id: contact.id,
    version: contact.version,
    title: {
      update: {
        id: title.id,
        version: title.version,
        name: "Dr."
      }
    }
  }
});

// Set relationship to null
const updated = await client.contact.update({
  data: {
    id: contact.id,
    version: contact.version,
    title: {
      select: { id: null }
    }
  }
});

// Bulk update
const count = await client.user.updateAll({
  set: {
    status: "inactive"
  },
  where: {
    lastLogin: { lt: new Date("2024-01-01") }
  }
});
```

#### Deleting Records

```javascript
// Delete a single record (requires id and version)
const user = await client.user.findOne({ where: { id: userId } });
await client.user.delete({
  id: user.id,
  version: user.version
});

// Bulk delete
const count = await client.user.deleteAll({
  where: {
    status: "inactive"
  }
});
```

### Advanced Queries

#### Filtering

The ORM supports various filter operators:

**Comparison Operators:**
- `eq` - Equal to
- `ne` - Not equal to
- `gt` - Greater than
- `ge` - Greater than or equal
- `lt` - Less than
- `le` - Less than or equal

**String Operators:**
- `like` - Pattern matching (use % as wildcard)
- `notLike` - Negative pattern matching

**Array Operators:**
- `in` - Value in array
- `notIn` - Value not in array
- `between` - Value between range
- `notBetween` - Value not in range

**Logical Operators:**
- `AND` - All conditions must match
- `OR` - At least one condition must match
- `NOT` - Negate conditions

```javascript
// Comparison filters
const users = await client.user.find({
  where: {
    age: { ge: 18, le: 65 },
    status: { ne: "deleted" }
  }
});

// String filters
const contacts = await client.contact.find({
  where: {
    firstName: { like: "J%" },  // starts with J
    lastName: { like: "%son" }   // ends with son
  }
});

// Array filters
const users = await client.user.find({
  where: {
    status: { in: ["active", "pending"] },
    age: { between: [18, 65] }
  }
});

// Logical operators
const results = await client.contact.find({
  where: {
    AND: [
      { firstName: { like: "J%" } },
      { lastName: { like: "%n" } }
    ]
  }
});

const results = await client.contact.find({
  where: {
    OR: [
      { status: "active" },
      { priority: "high" }
    ]
  }
});

const results = await client.contact.find({
  where: {
    NOT: [
      { status: "deleted" },
      { archived: true }
    ]
  }
});
```

#### Relationships

**Querying with Relationships:**

```javascript
// Select nested relationships
const contacts = await client.contact.find({
  select: {
    firstName: true,
    lastName: true,
    title: {
      name: true,
      code: true
    },
    addresses: {
      select: {
        street: true,
        city: true,
        country: {
          name: true
        }
      }
    }
  }
});

// Filter by relationship properties
const contacts = await client.contact.find({
  where: {
    title: {
      code: { in: ["mr", "ms"] }
    },
    addresses: {
      city: "New York",
      country: {
        code: "us"
      }
    }
  }
});

// Filter collections in select
const contact = await client.contact.findOne({
  where: { id: contactId },
  select: {
    firstName: true,
    addresses: {
      where: {
        type: "home"
      }
    }
  }
});
```

**Managing Relationships:**

```javascript
// One-to-Many: Add children
const updated = await client.contact.update({
  data: {
    id: contact.id,
    version: contact.version,
    addresses: {
      create: [
        {
          contact: {},
          street: "456 Oak Ave",
          city: "Boston"
        }
      ]
    }
  }
});

// One-to-Many: Remove children
const updated = await client.contact.update({
  data: {
    id: contact.id,
    version: contact.version,
    addresses: {
      remove: addressId  // or [id1, id2] for multiple
    }
  }
});

// One-to-Many: Update child
const updated = await client.contact.update({
  data: {
    id: contact.id,
    version: contact.version,
    addresses: {
      update: [{
        id: address.id,
        version: address.version,
        street: "Updated Street"
      }]
    }
  }
});

// Many-to-Many: Link existing records
const contact = await client.contact.create({
  data: {
    firstName: "John",
    lastName: "Doe",
    circles: {
      select: [
        { id: circle1.id },
        { id: circle2.id }
      ]
    }
  }
});

// Many-to-Many: Create and link
const contact = await client.contact.create({
  data: {
    firstName: "Jane",
    lastName: "Doe",
    circles: {
      create: [
        { code: "family", name: "Family" },
        { code: "friends", name: "Friends" }
      ]
    }
  }
});
```

#### Sorting and Ordering

```javascript
// Sort by single field
const users = await client.user.find({
  orderBy: {
    name: "ASC"
  }
});

// Sort by multiple fields
const contacts = await client.contact.find({
  orderBy: {
    lastName: "ASC",
    firstName: "DESC"
  }
});

// Sort by relationship fields
const contacts = await client.contact.find({
  orderBy: {
    title: {
      name: "ASC"
    },
    firstName: "DESC"
  }
});

// Sort nested collections
const addresses = await client.address.find({
  where: { contact: { id: contactId } },
  orderBy: {
    city: "ASC",
    country: {
      name: "ASC"
    }
  }
});
```

#### Pagination

**Offset-based Pagination:**

```javascript
// Take first N records
const first5 = await client.contact.find({
  take: 5
});

// Skip and take (page 2, size 10)
const page2 = await client.contact.find({
  skip: 10,
  take: 10
});

// Take last N records (negative take)
const last5 = await client.contact.find({
  take: -5
});

// Skip from end (last 5, skipping last 2)
const results = await client.contact.find({
  take: -5,
  skip: 2
});
```

**Cursor-based Pagination:**

```javascript
// Get first page
const firstPage = await client.contact.find({
  select: {
    firstName: true,
    lastName: true
  },
  take: 10,
  orderBy: {
    id: "ASC"
  }
});

// Get next page using cursor
const lastItem = firstPage[firstPage.length - 1];
const nextPage = await client.contact.find({
  select: {
    firstName: true,
    lastName: true
  },
  take: 10,
  cursor: lastItem._cursor,
  orderBy: {
    id: "ASC"
  }
});

// Previous page (negative take)
const prevPage = await client.contact.find({
  take: -10,
  cursor: currentPage[0]._cursor
});
```

#### Aggregations

```javascript
// Simple count
const totalUsers = await client.user.count();

// Count with filter
const activeUsers = await client.user.count({
  where: { status: "active" }
});

// Aggregate operations
const stats = await client.order.aggregate({
  count: { id: true },
  sum: { total: true },
  avg: { total: true },
  min: { total: true },
  max: { total: true }
});

// Group by
const statsByStatus = await client.order.aggregate({
  count: { id: true },
  avg: { total: true },
  groupBy: {
    status: true
  }
});

// Group by with relationships
const statsByCountry = await client.order.aggregate({
  count: { id: true },
  sum: { total: true },
  groupBy: {
    customer: {
      country: {
        code: true
      }
    }
  }
});

// Having clause
const highValueCountries = await client.order.aggregate({
  count: { id: true },
  sum: { total: true },
  groupBy: {
    customer: {
      country: {
        code: true
      }
    }
  },
  having: {
    sum: {
      total: { gt: 100000 }
    }
  }
});
```

### Transactions

```javascript
// Execute operations in transaction
await client.$transaction(async (txClient) => {
  const user = await txClient.user.create({
    data: {
      name: "John Doe",
      email: "john@example.com"
    }
  });

  await txClient.profile.create({
    data: {
      user: { select: { id: user.id } },
      bio: "Software developer"
    }
  });

  // If any operation fails, entire transaction rolls back
});

// Transaction with error handling
try {
  await client.$transaction(async (txClient) => {
    // ... operations
    throw new Error("Force rollback");
  });
} catch (error) {
  // Transaction rolled back
  console.error("Transaction failed:", error);
}
```

### Special Features

#### Working with BigDecimal

```javascript
// Create record with decimal
const country = await client.country.create({
  data: {
    code: "US",
    name: "United States",
    population: "331.9"  // String for precision
  }
});

// Query with decimal comparison
const populous = await client.country.find({
  where: {
    population: { gt: "100" }
  }
});

// Arithmetic comparisons
const results = await client.country.find({
  where: {
    population: { between: ["10.00", "500.00"] }
  }
});
```

#### Working with LOB Fields (Text, JSON, Binary)

```javascript
// LOB fields must be used within transactions
await client.$transaction(async (txClient) => {
  const contact = await txClient.contact.create({
    data: {
      firstName: "John",
      lastName: "Doe",
      notes: Promise.resolve("Long text content..."),
      attrs: Promise.resolve({ key: "value" }),
      image: Promise.resolve(Buffer.from("binary data", "utf-8"))
    },
    select: {
      notes: true,
      attrs: true,
      image: true
    }
  });

  // LOB fields are returned as Promises
  const notes = await contact.notes;
  const attrs = await contact.attrs;
  const image = await contact.image;
});
```

#### Optimistic Locking

```javascript
// All records have a version field for optimistic locking
const user = await client.user.findOne({
  where: { id: userId }
});

// Update requires current version
const updated = await client.user.update({
  data: {
    id: user.id,
    version: user.version,  // Must match current version
    name: "Updated Name"
  }
});

// Version is automatically incremented
console.log(updated.version); // user.version + 1

// Update with wrong version fails
await client.user.update({
  data: {
    id: user.id,
    version: 1,  // Outdated version
    name: "Will fail"
  }
}); // Throws error or returns null
```

#### Distinct Queries

```javascript
// Get distinct values
const uniqueNames = await client.contact.find({
  select: {
    firstName: true,
    lastName: true
  },
  distinct: true
});
```

### Best Practices

1. **Always use transactions for LOB fields** (Text, JSON, Binary)
2. **Include version field when updating** for optimistic locking
3. **Use cursor-based pagination** for better performance on large datasets
4. **Select only needed fields** to reduce data transfer
5. **Use indexes** on frequently queried fields
6. **Leverage relationship filters** instead of multiple queries
7. **Use bulk operations** (updateAll, deleteAll) for better performance

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
