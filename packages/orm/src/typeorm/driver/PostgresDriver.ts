import { DataSource, QueryRunner, ReplicationMode } from "typeorm";
import { PostgresDriver as BasePostgresDriver } from "typeorm/driver/postgres/PostgresDriver";
import { PostgresQueryRunner } from "./PostgresQueryRunner";

export class PostgresDriver extends BasePostgresDriver {
  constructor(connection?: DataSource) {
    super(connection);
    this.supportedDataTypes.push("oid" as any); // for large object support
  }

  createQueryRunner(mode: ReplicationMode): QueryRunner {
    return new PostgresQueryRunner(this, mode);
  }
}
