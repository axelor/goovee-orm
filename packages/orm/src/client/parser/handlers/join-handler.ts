import { Repository } from "typeorm";
import { ParserContext } from "../context";

export class JoinHandler {
  constructor(private context: ParserContext) {}

  processRelationJoin(
    repo: Repository<any>,
    relation: any,
    key: string,
    prefix: string,
  ): { name: string; alias: string } {
    const name = this.context.makeName(prefix, key);
    const alias = this.context.makeAlias(repo, prefix, key);
    return { name, alias };
  }

  getRelationRepository(repo: Repository<any>, relation: any): Repository<any> {
    return repo.manager.getRepository(relation.type);
  }

  isToOneRelation(relation: any): boolean {
    return relation.isOneToOne || relation.isManyToOne;
  }

  isToManyRelation(relation: any): boolean {
    return relation.isOneToMany || relation.isManyToMany;
  }
}
