import { ParseResult } from "../../parser";
import { OrmRepository } from "../types";

export const runAggregate = async (
  repo: OrmRepository<any>,
  options: ParseResult,
) => {
  const {
    select = {},
    where,
    params = {},
    joins = {},
    groups = {},
    having,
    aliasMap = {},
    take,
    skip,
  } = options;

  // Create a fresh query builder for aggregates to avoid default selections
  const sq = repo.createQueryBuilder("self");

  // Start with an empty selection - crucial for aggregate queries
  sq.select("1", "dummy"); // Add a dummy selection that will be replaced

  // Add all aggregate and group by selections
  let isFirstSelect = true;
  Object.entries(select).forEach(([expression, alias]) => {
    if (isFirstSelect) {
      sq.select(expression, alias); // Replace the dummy selection
      isFirstSelect = false;
    } else {
      sq.addSelect(expression, alias);
    }
  });

  // If no selections were added, we need at least one for the query to work
  if (isFirstSelect) {
    sq.select("COUNT(*)", "count_all");
  }

  // Add joins for relations used in aggregates
  Object.entries(joins).forEach(([name, alias]) => {
    sq.leftJoin(name, alias);
  });

  // Add WHERE conditions
  if (where) {
    sq.andWhere(where, params);
  }

  // Add GROUP BY clauses
  Object.entries(groups).forEach(([field, alias]) => {
    sq.addGroupBy(field);
  });

  // Add HAVING conditions (post-aggregation filtering)
  if (having) {
    sq.having(having, params);
  }

  // Add pagination
  if (take !== undefined) sq.limit(take);
  if (skip !== undefined) sq.offset(skip);

  // Execute the query and get raw results
  const rawResults = await sq.getRawMany();

  // Helper function to convert values based on aggregate operation
  const convertAggregateValue = (value: any, originalPath: string): any => {
    const pathParts = originalPath.split(".");
    const operation = pathParts[0]; // count, avg, sum, min, max, groupBy

    switch (operation) {
      case "count":
        // COUNT should always return a number, even if it's 0
        return value === null ? 0 : parseInt(value, 10);
      case "sum":
        // SUM can be null if there are no rows, or a number
        return value === null ? null : parseInt(value, 10);
      case "avg":
        // AVG can be null if there are no rows, or a float
        return value === null ? null : parseFloat(value);
      case "min":
      case "max":
        // For min/max, we need to preserve the original type
        // Numbers should be converted, strings/dates should remain as-is
        if (value === null) return null;
        if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value)) {
          return parseFloat(value);
        }
        return value;
      case "groupBy":
        // GroupBy values should preserve their original types
        // Only convert if it's clearly a number
        if (value === null) return null;
        if (typeof value === "string" && /^\d+$/.test(value)) {
          return parseInt(value, 10);
        } else if (typeof value === "string" && /^\d+\.\d+$/.test(value)) {
          return parseFloat(value);
        }
        return value;
      default:
        return value;
    }
  };

  // Transform raw results using aliasMap to restore dotted path structure
  const transformedResults = rawResults.map((raw) => {
    const result: any = {};

    // Transform each field using the aliasMap
    Object.entries(raw).forEach(([sqlAlias, value]) => {
      const originalPath = aliasMap[sqlAlias];
      if (originalPath) {
        // Convert value based on the operation type
        const convertedValue = convertAggregateValue(value, originalPath);

        // Convert dotted path back to nested object structure
        const parts = originalPath.split(".");
        let current = result;

        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }

        // Set the final converted value
        const finalKey = parts[parts.length - 1];
        current[finalKey] = convertedValue;
      } else {
        // If no alias mapping, use the SQL alias directly
        result[sqlAlias] = value;
      }
    });

    return result;
  });

  return transformedResults;
};
