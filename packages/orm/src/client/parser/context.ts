import { Repository } from "typeorm";
import { EntityOptions } from "../../schema";
import { ClientFeatures, QueryClient } from "../types";
import { WhereResult, JSON_CAST_TYPES } from "./types";

export function acceptWhereCauses(
  items: WhereResult[],
  joiner: string = "AND",
): WhereResult {
  const where = items.map((x) => x.where).join(` ${joiner} `);
  const params = items.reduce((prev, x) => ({ ...prev, ...x.params }), {});
  const joins = items.reduce((prev, x) => ({ ...prev, ...x.joins }), {});
  return { where, params, joins };
}

export function findJsonType(value: any): keyof typeof JSON_CAST_TYPES {
  if (Array.isArray(value)) value = value[0];
  if (typeof value === "number") return "Int";
  if (typeof value === "boolean") return "Boolean";
  if (/^(-)?(\d+)(\.\d+)?$/.test(value)) return "Decimal";
  if (/^(\d{4})-(\d{2})-(\d{2}).*$/.test(value)) return "Date";
  return "String";
}

export function findJsonCastType(type?: keyof typeof JSON_CAST_TYPES): string {
  return JSON_CAST_TYPES[type ?? "String"];
}

export class ParserContext {
  private counter = 0;
  private usedAliases = new Set<string>();
  public readonly schema: EntityOptions[];
  public readonly features: ClientFeatures;
  
  // PostgreSQL NAMEDATALEN limit - using 16 for testing, should be 63 for production
  private readonly MAX_ALIAS_LENGTH = 16;

  constructor(client: QueryClient) {
    this.schema = (client as any).__schema;
    this.features = (client as any).__features ?? {};
  }

  nextParam(): string {
    return `p${this.counter++}`;
  }

  nextQuery(): string {
    return `q${this.counter++}`;
  }

  /**
   * Simple hash function for generating consistent short suffixes
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Truncates and ensures uniqueness of PostgreSQL aliases that exceed NAMEDATALEN limit
   */
  truncateAlias(alias: string): string {
    if (alias.length <= this.MAX_ALIAS_LENGTH) {
      if (!this.usedAliases.has(alias)) {
        this.usedAliases.add(alias);
        return alias;
      }
    }

    // If alias is too long or already used, create a truncated version with hash
    const hash = this.simpleHash(alias);
    const hashSuffix = `_${hash}`;
    const maxBaseLength = this.MAX_ALIAS_LENGTH - hashSuffix.length;
    const base = alias.substring(0, maxBaseLength);
    const uniqueAlias = `${base}${hashSuffix}`;
    
    this.usedAliases.add(uniqueAlias);
    return uniqueAlias;
  }

  isStringField(repo: Repository<any>, name: string): boolean {
    if (!this.schema) return false;
    const schemaDef = this.schema.find(
      (x) => x.name === repo.metadata.targetName,
    );
    const fieldDef = schemaDef?.fields?.find((x) => x.name === name);
    return fieldDef?.type === "String";
  }

  makeName(prefix: string, name: string): string {
    return `${prefix}.${name}`;
  }

  makeAlias(repo: Repository<any>, prefix: string, name: string): string {
    const col = repo.metadata.findColumnWithPropertyName(name);
    const alt = col?.databaseName ?? name;
    const p = prefix.replace(/^[_]+/, "");
    const a = `${p}_${alt}`;
    return a;
  }

  normalize(
    repo: Repository<any>,
    fieldName: string,
    variable: string,
  ): string {
    const { normalization = {} } = this.features;
    const { lowerCase = false, unaccent = false } = normalization;

    // Only apply normalization to string fields
    if (!this.isStringField(repo, fieldName)) return variable;

    let res = variable;
    if (lowerCase) res = `lower(${res})`;
    if (unaccent) res = `unaccent(${res})`;
    return res;
  }

  isJson(repo: Repository<any>, name: string): boolean {
    const column = repo.metadata.findColumnWithPropertyName(name);
    return !!(column && column.type === "jsonb");
  }

  sortJoins(joins: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(joins).sort((a, b) => {
        const a1 = a[1] as string;
        const b1 = b[1] as string;
        if (a1 === b1) return 0;
        if (a1.startsWith(b1)) return 1;
        if (b1.startsWith(a1)) return -1;
        return 0;
      }),
    );
  }
}