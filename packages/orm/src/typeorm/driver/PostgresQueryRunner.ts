import { Table, TableColumn } from "typeorm";
import { PostgresQueryRunner as BasePostgresQueryRunner } from "typeorm/driver/postgres/PostgresQueryRunner";
import { Query } from "typeorm/driver/Query";

export class PostgresQueryRunner extends BasePostgresQueryRunner {
  private isIdColumn(column: string | TableColumn) {
    return typeof column === "object" ? column.name === "id" : column === "id";
  }

  private buildIdSequence(table: string | Table) {
    const name = typeof table === "object" ? table.name : table;
    return `${name}_seq`;
  }

  protected buildSequenceName(
    table: Table,
    columnOrName: string | TableColumn
  ): string {
    return this.isIdColumn(columnOrName)
      ? this.buildIdSequence(table)
      : super.buildSequenceName(table, columnOrName);
  }

  async createTable(
    table: Table,
    ifNotExist?: boolean | undefined,
    createForeignKeys?: boolean | undefined,
    createIndices?: boolean | undefined
  ): Promise<void> {
    const upQueries: Query[] = [];
    const downQueries: Query[] = [];

    const id = table.columns.find((x) => x.name === "id");
    if (id) {
      upQueries.push(
        new Query(
          `CREATE SEQUENCE IF NOT EXISTS ${this.escapePath(
            this.buildSequencePath(table, id)
          )} OWNED BY ${this.escapePath(table)}."${id.name}"`
        )
      );
      downQueries.push(
        new Query(
          `DROP SEQUENCE ${this.escapePath(this.buildSequencePath(table, id))}`
        )
      );
    }

    await super.createTable(
      table,
      ifNotExist,
      createForeignKeys,
      createIndices
    );

    await this.executeQueries(upQueries, downQueries);
  }

  private transformInsert(query: string) {
    const reg =
      /INSERT INTO "(?<table>[\w.]+)"\((?<columns>[^()]+)\) VALUES (?<tuples>\(([^()]+)\)(?:, \(([^()]+)\))*)(?<tail>.*)/i;
    const res = reg.exec(query);
    if (res && res.groups) {
      const { table, columns, tuples, tail } = res.groups;
      const names = columns
        .split(",")
        .map((x) => x.trim())
        .map((x) => x.replace(/^"(.*)"$/, "$1"));

      const idx = names.findIndex((x) => x === "id");
      if (idx == -1) {
        return query;
      }

      const seq = this.buildIdSequence(table);
      const idValue = `nextval('${seq}')`;

      const values = tuples.replace(/\(([^()]+)\)/g, (m, items: string) => {
        const params = items.split(",").map((x) => x.trim());
        params[idx] = idValue;
        return `(${params.join(", ")})`;
      });

      const ts = tail.replace(
        'RETURNING "version"',
        'RETURNING "id", "version"'
      );
      const qs = `INSERT INTO "${table}"(${columns}) VALUES ${values}${ts}`;
      return qs;
    }
    return query;
  }

  query(
    query: string,
    parameters?: any[] | undefined,
    useStructuredResult?: boolean | undefined
  ): Promise<any> {
    if (/^INSERT INTO/i.test(query)) query = this.transformInsert(query);
    return super.query(query, parameters, useStructuredResult);
  }
}
