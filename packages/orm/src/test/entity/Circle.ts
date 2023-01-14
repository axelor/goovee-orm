import { Entity, Column } from "typeorm";
import { Model } from "./Model";

@Entity("contact_circle")
export class Circle extends Model {
  @Column()
  code!: string;

  @Column()
  name!: string;
}
