import { Entity, Column } from "typeorm";
import { Model } from "./Model";

@Entity("contact_country")
export class Country extends Model {
  @Column()
  code!: string;

  @Column()
  name!: string;
}
