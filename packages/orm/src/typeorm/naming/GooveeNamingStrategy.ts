import { DefaultNamingStrategy } from "typeorm/naming-strategy/DefaultNamingStrategy";
import { NamingStrategyInterface } from "typeorm/naming-strategy/NamingStrategyInterface";

import { snakeCase } from "typeorm/util/StringUtils";

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
    embeddedPrefixes: string[]
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
    secondPropertyName: string
  ): string {
    return join(snakeCase(firstTableName), snakeCase(firstPropertyName));
  }

  joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string
  ): string {
    return snakeCase(tableName);
  }

  joinTableInverseColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
    inverse?: boolean
  ): string {
    throw new Error("Please provide `inverseJoinColumn` name!");
  }
}
