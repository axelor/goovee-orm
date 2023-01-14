import { Entity, ManyToOne, Column, OneToMany, ManyToMany, JoinTable, BeforeInsert, BeforeUpdate } from "typeorm";
import { Model } from "./Model";
import { Title } from "./Title";
import { Address } from "./Address";
import { Circle } from "./Circle";

@Entity("contact_contact")
export class Contact extends Model {
  @ManyToOne(() => Title)
  title?: Title;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ nullable: true })
  fullName?: string;

  @Column({ nullable: true })
  dateOfBirth?: Date;

  @Column({ nullable: true })
  image?: string;

  @Column({ nullable: true })
  notes?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  phone?: string;

  @OneToMany(() => Address, (x) => x.contact)
  addresses?: Address[];

  @ManyToMany(() => Circle)
  @JoinTable({ name: "contact_contact_circles", joinColumn: { name: "contact_contact" }, inverseJoinColumn: { name: "circles" } })
  circles?: Circle[];

  @BeforeInsert()
  @BeforeUpdate()
  protected computeFullName() {
    this.fullName = (() => {
      if (this.title) {
        return `${this.title.name} ${this.firstName} ${this.lastName}`
      }
      return `${this.firstName} ${this.lastName}`
    })();
  }
}
