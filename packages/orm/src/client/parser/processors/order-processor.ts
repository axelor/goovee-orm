import { Repository } from "typeorm";
import { ParserContext } from "../context";
import { JsonQueryHandler } from "../handlers/json-handler";
import { JoinHandler } from "../handlers/join-handler";
import { OrderResult, OrderByOptions, OrderBy, JsonOrderBy } from "../types";

export class OrderByProcessor {
  constructor(
    private context: ParserContext,
    private jsonHandler: JsonQueryHandler,
    private joinHandler: JoinHandler,
  ) {}

  process(
    repo: Repository<any>,
    opts: OrderByOptions<any>,
    prefix: string,
  ): OrderResult {
    let order: Record<string, OrderBy> = {};
    let joins: Record<string, string> = {};
    let select: Record<string, string> = {};

    for (const [key, value] of Object.entries(opts)) {
      const name = this.context.makeName(prefix, key);
      const relation = repo.metadata.findRelationWithPropertyPath(key);

      if (relation) {
        const result = this.processRelationOrderBy(
          relation,
          value,
          key,
          name,
          prefix,
          repo,
        );
        joins = { ...joins, ...result.joins };
        order = { ...order, ...result.order };
        select = { ...select, ...result.select };
      } else if (this.context.isJson(repo, key)) {
        if (Array.isArray(value)) {
          const jsonOrder = this.jsonHandler.processJsonOrderBy(
            value as JsonOrderBy,
            name,
          );
          order = { ...order, ...jsonOrder };
        }
      } else {
        select[name] = this.context.makeAlias(repo, prefix, key);
        order[this.context.normalize(repo, key, name)] = value as OrderBy;
      }
    }

    return { order, joins, select };
  }

  private processRelationOrderBy(
    relation: any,
    value: any,
    key: string,
    name: string,
    prefix: string,
    repo: Repository<any>,
  ): OrderResult {
    const rRepo = this.joinHandler.getRelationRepository(repo, relation);
    const alias = this.context.makeAlias(repo, prefix, key);
    const res = this.process(rRepo, value as OrderByOptions<any>, alias);

    return {
      joins: { [name]: alias, ...res.joins },
      order: { ...res.order },
      select: { ...res.select },
    };
  }

  ensureUniqueOrderBy(
    repo: Repository<any>,
    opts: OrderByOptions<any>,
  ): Record<string, OrderBy> {
    const hasUniqueField = Object.keys(opts).some((name) =>
      this.isNonNullUnique(repo, name),
    );
    return hasUniqueField ? {} : { "self.id": "ASC" as OrderBy };
  }

  private isNonNullUnique(repo: Repository<any>, name: string): boolean {
    const column = repo.metadata.findColumnWithPropertyName(name);
    if (column?.isPrimary) return true;
    if (column?.isNullable) return false;
    return !!(
      column &&
      repo.metadata.uniques.some((x) => {
        return (
          x.columns.length === 1 &&
          x.columns[0].databaseName === column.databaseName
        );
      })
    );
  }
}
