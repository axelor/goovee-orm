import { Repository } from "typeorm";
import { ParserContext } from "../context";
import { JoinHandler } from "../handlers/join-handler";
import {
  ParseResult,
  ProcessResult,
  QueryClient,
  SelectOptions,
} from "../types";
import { QueryProcessor } from "./query-processor";

export class SelectProcessor {
  constructor(
    private context: ParserContext,
    private joinHandler: JoinHandler,
  ) {}

  process(
    repo: Repository<any>,
    opts: SelectOptions<any>,
    prefix: string,
    client: QueryClient,
  ): ProcessResult {
    let select: Record<string, string> = {};
    let collections: Record<string, ParseResult> = {};
    let references: Record<string, ParseResult> = {};
    let joins: Record<string, string> = {};

    // if no selection is given, select all simple fields
    const selection =
      Object.keys(opts).length === 0 ? this.getSimpleSelect(repo) : opts;

    for (const [key, value] of Object.entries(selection)) {
      const { name, alias } = this.joinHandler.processRelationJoin(
        repo,
        null,
        key,
        prefix,
      );
      const relation = repo.metadata.findRelationWithPropertyPath(key);

      if (relation) {
        const result = this.processRelation(
          relation,
          key,
          value,
          name,
          alias,
          repo,
          client,
        );
        select = { ...select, ...result.select };
        joins = { ...joins, ...result.joins };
        collections = { ...collections, ...result.collections };
        references = { ...references, ...result.references };
      } else {
        select[name] = alias;
      }
    }

    return { select, joins, references, collections };
  }

  private getSimpleSelect(repo: Repository<any>): Record<string, boolean> {
    const meta = repo.metadata;
    return meta.columns
      .filter((x) => !meta.findRelationWithPropertyPath(x.propertyName))
      .filter((x) => !["oid", "text", "jsonb"].includes(x.type as any))
      .map((x) => x.propertyName)
      .reduce((prev, name) => ({ ...prev, [name]: true }), {});
  }

  private processRelation(
    relation: any,
    key: string,
    value: any,
    name: string,
    alias: string,
    repo: Repository<any>,
    client: QueryClient,
  ): ProcessResult {
    const rRepo = this.joinHandler.getRelationRepository(repo, relation);
    const result: ProcessResult = {
      select: {},
      joins: {},
      references: {},
      collections: {},
    };

    if (value === true && this.joinHandler.isToOneRelation(relation)) {
      const nested = this.process(
        rRepo,
        this.getSimpleSelect(rRepo),
        alias,
        client,
      );
      result.select = { ...result.select, ...nested.select };
      result.joins[name] = alias;
      return result;
    }

    if (this.joinHandler.isToManyRelation(relation)) {
      const v =
        value === true ? { select: this.getSimpleSelect(rRepo) } : value;
      const vResult = QueryProcessor.parse(client, rRepo, v);
      result.collections[key] = vResult;
    } else {
      const nested = QueryProcessor.parse(client, rRepo, { select: value });
      result.references[key] = nested;
    }

    return result;
  }
}
