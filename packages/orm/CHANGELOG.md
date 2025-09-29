# Changelog

## [0.0.5] (2025-09-29)

### ✨ Features

- **Client Transpilation Support:** Added support to generate transpiled client code using the Goovee CLI.
- **Distinct Query Support:** Added `distinct` support for eliminating duplicate results in queries.

### 🐛 Bug Fixes

- **Nested Collection Search:** Fixed duplicate results when searching on nested collection fields.
- **CLI Build Tool:** Fixed swc-node usage for CLI to improve build performance and compatibility.

## [0.0.4] (2025-07-15)

### ✨ Features

- **Config File Support:** Added support for configuration files (`goovee.config.json`) with multiple schema directory support, custom output directory, and clean flag options.

- **Aggregate Queries:** A powerful new `aggregate` feature has been introduced, allowing for complex data aggregation and analysis. This includes support for `count`, `avg`, `sum`, `min`, and `max` operations, as well as `groupBy` and `having` clauses.
- **Normalized String Search:** Added support for case-insensitive and accent-insensitive searches on string fields. This can be enabled through the `normalization` feature in the client options.
- **BigDecimal Support:** Introduced a `BigDecimal` class for handling decimal values with arbitrary precision, preventing common floating-point inaccuracies.
- **Numeric Filters on String Fields:** It is now possible to use numeric comparison operators (e.g., `gt`, `lt`) on string fields that contain numeric values.
- **Null Values in CRUD Operations:** Allow `null` values in create and update operations for optional fields, providing more flexibility when creating or updating entities.
- **AuditableModel with Configurable Audit Fields:** Introduced `AuditableModel` abstract entity with automatic `createdOn` and `updatedOn` timestamp management. Entities extend `AuditableModel` by default for audit functionality, or can be configured with `auditable: false` to extend the base `Model` class instead.

### 🚀 Performance

- **N+1 Query Optimization:** Optimized relation loading to prevent the "N+1 query problem," significantly reducing the number of queries executed when fetching related entities.
- **Cursor Pagination Optimization:** Improved the performance of cursor-based pagination by eliminating redundant queries.
- **Test Performance:** Optimized test performance by using a `tmpfs` for the PostgreSQL container's data directory and adding performance-related flags.

### 🐛 Bug Fixes

- **`createdOn` and `updatedOn` Management:** Fixed an issue where the `createdOn` and `updatedOn` fields were not being managed properly.
- **Multiple Filters on Same Field:** Fixed a bug where multiple filters on the same field were being overwritten.
- **Decimal Field Generation:** Corrected an issue with the generation of decimal fields in the database schema.
- **GraphQL Test:** Fixed a failing GraphQL test by using `dayjs` for consistent date formatting.
- **Vitest Source Lines:** Fixed an issue where `vitest` was not showing the correct source lines in error stack traces.
- **`test:e2e` Script:** Fixed the `test:e2e` script for more reliable and informative end-to-end testing.
- **Type Issues:** Resolved several type inconsistencies in the codebase.
- **CI Script:** Fixed CI script configuration issues.

### 🔨 Refactoring

- **Code Organization:** Refactored several modules, including the client repository, generator, parser, and types, into smaller, more manageable files for improved code organization and maintainability.
- **Static Test Data:** Replaced the `faker` library with static test data to ensure more deterministic and reliable tests.
- **Base Entity:** Ensured that all generated entities extend the `Model` base class for better consistency and code reuse.
- **Build System Migration:** Migrated build system from TypeScript to rslib for dual ESM and CommonJS support.

## [0.0.3] (2025-06-18)

### 🐛 Bug Fixes

- **Boolean Field Query:** Fixed an issue with querying on boolean fields using `ne` and `eq` operators.
- **Schema Generator Tests:** Improved the robustness of schema generator tests by ensuring proper cleanup of temporary files.
- **Undefined Error:** Fixed an `undefined` error that could occur in pagination when `start` or `end` were not defined.
- **Join Table Incompatibility:** Resolved an incompatibility issue with join table naming when using the `axelor/goovee` naming convention.
- **SQL Syntax Error:** Fixed a syntax error for the `NOT NULL` operator in generated SQL queries.
- **Nested Joins:** Corrected an issue where nested joins were not ordered properly, leading to "join not found" errors.
- **Temporal Types:** Ensured correct mapping of temporal types (`DateTime`, `Date`, `Time`) to their respective database types.

### 🧹 Chore

- **Code Formatting:** Applied consistent code formatting across the codebase.

## v0.0.2

### ✨ Features

- **Disable DB Sync:** Added support to disable database synchronization per entity, providing more control over schema management.

## v0.0.1

### ✨ Features

- **Initial Client API Implementation:** Introduced the foundational client API, enabling basic data operations.
- **Query Parser:** Implemented a robust query parser to translate client queries into database-understandable formats.
- **Code Generator:** Developed a code generator for TypeScript, facilitating the creation of boilerplate code.
- **GraphQL Integration:** Added comprehensive GraphQL support, including schema generation and resolvers for create, read, update, and delete operations.
- **Optimistic Locking:** Implemented version-based optimistic locking to prevent concurrent modification conflicts.
- **Custom Naming Strategy:** Introduced an Axelor-style naming strategy for TypeORM, ensuring consistent database object naming.
- **Large Object Support:** Added support for large objects (LOBs) for handling binary data.
- **JSON Field Querying:** Implemented advanced querying capabilities for JSON fields, including filtering and ordering by attributes.
- **Cursor-Based Pagination:** Introduced cursor-based pagination for efficient and reliable data retrieval in large datasets.
- **Middleware Support:** Added middleware support to the client API, allowing for custom logic injection into the request-response cycle.

### 🐛 Bug Fixes

- **Circular Dependency:** Fixed circular dependency issues in generated model classes.
- **Nested Selection/CRUD:** Resolved issues with nested select, create, and update operations on relational and collection fields.
- **Type Inference:** Corrected type inference issues in various parts of the codebase.
- **Null Filters:** Fixed issues related to filtering with null values.
- **Entity Table Naming:** Ensured correct entity table naming in generated code.
- **Enum Fields:** Fixed issues with nullable attributes and tests for enum fields.
- **Binary Fields:** Resolved type checking issues and ensured proper lazy loading for binary fields.

### 🔨 Refactoring

- **Module Exports:** Reworked module exports for better organization and clarity.
- **CLI Commands:** Refactored CLI commands for improved usability and maintainability.
- **Test Infrastructure:** Improved test client usage and separated unit and e2e tests for better test management.
- **Dependency Management:** Upgraded various dependencies to their latest versions.
- **Schema Generation:** Made schema generation configurable and removed resolver options.
- **Lazy Fields:** Ensured JSON, Text, and Binary fields are truly lazy-loaded.
- **Bi-directional Relations:** Improved generation of TypeORM compliant bi-directional relations.

### 🧹 Chore

- **Initial Project Setup:** Established the initial project structure and core dependencies.
- **CI/CD Integration:** Added `.gitlab-ci.yml` for continuous integration and deployment.

[0.0.5]: https://github.com/axelor/goovee-orm/compare/0.0.4...0.0.5
[0.0.4]: https://github.com/axelor/goovee-orm/compare/0.0.3...0.0.4
[0.0.3]: https://github.com/axelor/goovee-orm
