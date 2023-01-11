import { Entity, Column } from "typeorm";
import { Model } from "./Model";

@Entity("contact_title")
export class Title extends Model {
  @Column()
  code!: string;

  @Column()
  name!: string;
}
