import { Entity, PrimaryColumn, VersionColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("model")
export abstract class Model {
  @PrimaryColumn({ type: "bigint" })
  id?: string;

  @VersionColumn({ nullable: true })
  version?: number;

  @CreateDateColumn({ nullable: true })
  readonly createdOn?: Date;

  @UpdateDateColumn({ nullable: true })
  readonly updatedOn?: Date;
}
