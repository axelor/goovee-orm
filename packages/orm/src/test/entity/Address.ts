import { Entity, ManyToOne, Column } from "typeorm";
import { Model } from "./Model";
import { Contact } from "./Contact";
import { AddressType } from "./AddressType";
import { Country } from "./Country";

@Entity("contact_address")
export class Address extends Model {
  @ManyToOne(() => Contact)
  contact!: Contact;

  @Column({ enum: AddressType, nullable: true, type: "varchar", length: 255 })
  type?: AddressType;

  @Column({ length: 255 })
  street!: string;

  @Column({ nullable: true, length: 255 })
  area?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  zip?: string;

  @Column({ nullable: true })
  state?: string;

  @ManyToOne(() => Country)
  country?: Country;
}
