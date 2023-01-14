import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { defineEntity } from ".";
import { generateSchema } from "./schema-generator";

const Title = defineEntity({
  name: "Title",
  table: "titles",
  extends: "Model",
  fields: [
    {
      name: "code",
      type: "String",
      required: true,
    },
    {
      name: "name",
      type: "String",
      required: true,
    },
  ],
});

const Country = defineEntity({
  name: "Country",
  table: "countries",
  extends: "Model",
  fields: [
    {
      name: "code",
      type: "String",
      required: true,
    },
    {
      name: "name",
      type: "String",
      required: true,
    },
  ],
});

const Address = defineEntity({
  name: "Address",
  table: "addresses",
  extends: "Model",
  fields: [
    {
      name: "contact",
      type: "ManyToOne",
      required: true,
      target: "Contact",
    },
    {
      name: "type",
      type: "Enum",
      default: "home",
      enumType: "AddressType",
      enumList: [
        {
          name: "HOME",
          value: 100,
        },
        {
          name: "OFFICE",
          value: "office",
        },
      ],
    },
    {
      name: "line1",
      type: "String",
      required: true,
    },
    {
      name: "line2",
      type: "String",
    },
    {
      name: "city",
      type: "String",
    },
    {
      name: "country",
      type: "ManyToOne",
      target: "Country",
    },
  ],
});

const Circle = defineEntity({
  name: "Circle",
  table: "circles",
  extends: "Model",
  fields: [
    {
      name: "code",
      type: "String",
      required: true,
    },
    {
      name: "name",
      type: "String",
      required: true,
    },
  ],
});

const Contact = defineEntity({
  name: "Contact",
  table: "contacts",
  extends: "Model",
  fields: [
    {
      name: "title",
      type: "ManyToOne",
      target: "Title",
    },
    {
      name: "firstName",
      type: "String",
      required: true,
    },
    {
      name: "lastName",
      type: "String",
      required: true,
    },
    {
      name: "dateOfBirth",
      type: "Date",
    },
    {
      name: "Phone",
      type: "String",
    },
    {
      name: "email",
      type: "String",
    },
    {
      name: "addresses",
      type: "OneToMany",
      target: "Address",
      mappedBy: "contact",
    },
    {
      name: "circles",
      type: "ManyToMany",
      target: "Circle",
    },
    {
      name: "type",
      type: "Enum",
      default: 1,
      enumType: "ContactType",
      enumList: [
        {
          name: "PARTNER",
          value: 1,
        },
        {
          name: "CUSTOMER",
          value: 2,
        },
      ],
    },
  ],
});

const expectedCode = `\
import { Entity, ManyToOne, Column, OneToMany, ManyToMany, JoinTable } from "typeorm";
import { Model } from "./Model";
import { Title } from "./Title";
import { Address } from "./Address";
import { Circle } from "./Circle";
import { ContactType } from "./ContactType";

@Entity("contacts")
export class Contact extends Model {
  @ManyToOne(() => Title)
  title?: Title;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ nullable: true })
  dateOfBirth?: Date;

  @Column({ nullable: true })
  Phone?: string;

  @Column({ nullable: true })
  email?: string;

  @OneToMany(() => Address, (x) => x.contact)
  addresses?: Address[];

  @ManyToMany(() => Circle)
  @JoinTable({ name: "contacts_circles", joinColumn: { name: "contacts" }, inverseJoinColumn: { name: "circles" } })
  circles?: Circle[];

  @Column({ enum: ContactType, nullable: true, type: "integer", default: ContactType.PARTNER })
  type?: ContactType;
}
`;

const expectedFiles = [
  "Model.ts",
  "AddressType.ts",
  "ContactType.ts",
  "Title.ts",
  "Country.ts",
  "Circle.ts",
  "Address.ts",
  "Contact.ts",
  "index.ts"
];

const outDir = path.join("node_modules", "code-gen");

const cleanUp = () => {
  expectedFiles
    .map((x) => path.join(outDir, x))
    .filter((x) => fs.existsSync(x))
    .forEach((x) => {
      fs.rmSync(x);
    });
  if (fs.existsSync(outDir)) {
    fs.rmdirSync(outDir);
  }
};

describe("schema generator tests", () => {
  afterEach(cleanUp);
  it("should generate entity classes", () => {
    const files = generateSchema(outDir, [
      Title,
      Country,
      Circle,
      Address,
      Contact,
    ]);

    expect(files).toHaveLength(expectedFiles.length);
    expect(files).toEqual(expect.arrayContaining(expectedFiles));

    const code = fs.readFileSync(path.join(outDir, "Contact.ts"), {
      encoding: "utf-8",
    });

    expect(code).toBe(expectedCode);
  });
});
