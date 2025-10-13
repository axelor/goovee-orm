import crypto from "node:crypto";

import { Table } from "typeorm";
import { DefaultNamingStrategy } from "typeorm/naming-strategy/DefaultNamingStrategy.js";
import { NamingStrategyInterface } from "typeorm/naming-strategy/NamingStrategyInterface.js";

import { snakeCase } from "typeorm/util/StringUtils.js";

const join = (...args: string[]) => args.join("_");

export class GooveeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? snakeCase(targetName);
  }

  columnName(
    propertyName: string,
    customName: string,
    embeddedPrefixes: string[],
  ): string {
    return customName ?? snakeCase(propertyName);
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(relationName);
  }

  joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
    secondPropertyName: string,
  ): string {
    return join(snakeCase(firstTableName), snakeCase(firstPropertyName));
  }

  joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return snakeCase(tableName);
  }

  joinTableInverseColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
    inverse?: boolean,
  ): string {
    throw new Error("Please provide `inverseJoinColumn` name!");
  }

  // based on hibernate implementation
  private generateHashedConstraintName(
    prefix: string,
    tableOrName: string | Table,
    columnNames: string[],
  ) {
    const table = tableOrName instanceof Table ? tableOrName.name : tableOrName;
    const cols = [...columnNames].sort();
    const names = [`table\`${table}\``, ...cols.map((x) => `column\`${x}\``)];

    const digest = crypto.createHash("md5");
    const hex = digest.update(names.join()).digest("hex");
    const num = BigInt(`0x${hex}`);
    const val = num.toString(35);

    return `${prefix}_${val}`;
  }

  uniqueConstraintName(tableOrName: string | Table, columnNames: string[]) {
    return this.generateHashedConstraintName("uk", tableOrName, columnNames);
  }

  indexName(
    tableOrName: string | Table,
    columnNames: string[],
    where?: string | undefined,
  ) {
    const table = tableOrName instanceof Table ? tableOrName.name : tableOrName;
    const names = [table, ...columnNames];
    return `${names.join("_")}_idx`;
  }

  foreignKeyName(
    tableOrName: string | Table,
    columnNames: string[],
    _referencedTablePath?: string | undefined,
    _referencedColumnNames?: string[] | undefined,
  ) {
    return this.generateHashedConstraintName("fk", tableOrName, columnNames);
  }

  primaryKeyName(tableOrName: string | Table, columnNames: string[]) {
    const table =
      typeof tableOrName === "string" ? tableOrName : tableOrName.name;
    return `${table}_pkey`;
  }
}
