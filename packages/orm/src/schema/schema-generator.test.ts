import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { defineEntity } from ".";
import { generateSchema } from "./schema-generator";

const UniqueTest = defineEntity({
  name: "UniqueTest",
  fields: [
    {
      name: "name",
      type: "String",
      unique: true,
      index: true,
    },
    {
      name: "some",
      type: "String",
      index: true,
    },
    {
      name: "thing",
      type: "String",
      unique: true,
    },
    {
      name: "another",
      type: "String",
    },
    {
      name: "one",
      type: "String",
    },
  ],
  uniques: [
    {
      columns: ["some", "thing"],
    },
    {
      columns: ["some", "one"],
      name: "uk_some_one",
    },
  ],
  indexes: [
    {
      columns: ["another", "one"],
      unique: true,
    },
    {
      columns: ["some", "one"],
      unique: true,
      name: "idx_some_one",
    },
  ],
});

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
    {
      name: "contacts",
      type: "ManyToMany",
      target: "Contact",
      mappedBy: "circles",
    },
  ],
});

const Bio = defineEntity({
  name: "Bio",
  table: "bio",
  extends: "Model",
  fields: [
    {
      name: "contact",
      type: "OneToOne",
      target: "Contact",
      mappedBy: "bio",
    },
    {
      name: "content",
      type: "String",
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
      name: "bio",
      type: "OneToOne",
      target: "Bio",
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
    {
      name: "notes",
      type: "Text",
    },
    {
      name: "photo",
      type: "Binary",
    },
    {
      name: "attrs",
      type: "JSON",
    },
  ],
});

const expectedCode = `\
import { Entity, ManyToOne, Column, OneToOne, JoinColumn, OneToMany, ManyToMany, JoinTable } from "typeorm";
import { Model } from "./Model";
import { Title } from "./Title";
import { Bio } from "./Bio";
import { Address } from "./Address";
import { Circle } from "./Circle";
import { ContactType } from "./ContactType";
import { type Text, type Binary, type Json } from "@goovee/orm/dist/client";

@Entity()
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

  @OneToOne(() => Bio, (x) => x.contact)
  @JoinColumn()
  bio?: Bio;

  @OneToMany(() => Address, (x) => x.contact)
  addresses?: Address[];

  @ManyToMany(() => Circle, (x) => x.contacts)
  @JoinTable()
  circles?: Circle[];

  @Column({ enum: ContactType, nullable: true, type: "integer", default: ContactType.PARTNER })
  type?: ContactType;

  @Column({ nullable: true, type: "text", select: false })
  notes?: Text;

  @Column({ nullable: true, type: "oid" as any, select: false })
  photo?: Binary;

  @Column({ nullable: true, type: "jsonb", select: false })
  attrs?: Json;
}
`;

const expectedCodeGooveeNaming = `\
import { Entity, ManyToOne, Column, OneToOne, JoinColumn, OneToMany, ManyToMany, JoinTable } from "typeorm";
import { Model } from "./Model";
import { Title } from "./Title";
import { Bio } from "./Bio";
import { Address } from "./Address";
import { Circle } from "./Circle";
import { ContactType } from "./ContactType";
import { type Text, type Binary, type Json } from "@goovee/orm/dist/client";

@Entity("contact")
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

  @OneToOne(() => Bio, (x) => x.contact)
  @JoinColumn()
  bio?: Bio;

  @OneToMany(() => Address, (x) => x.contact)
  addresses?: Address[];

  @ManyToMany(() => Circle, (x) => x.contacts)
  @JoinTable({ name: "contact_circles", joinColumn: { name: "contact" }, inverseJoinColumn: { name: "circles" } })
  circles?: Circle[];

  @Column({ enum: ContactType, nullable: true, type: "integer", default: ContactType.PARTNER })
  type?: ContactType;

  @Column({ nullable: true, type: "text", select: false })
  notes?: Text;

  @Column({ nullable: true, type: "oid" as any, select: false })
  photo?: Binary;

  @Column({ nullable: true, type: "jsonb", select: false })
  attrs?: Json;
}
`;

const expectedUniqueCode = `\
import { Entity, Unique, Index, Column } from "typeorm";

@Entity("unique_test")
@Unique(["some", "thing"])
@Unique("uk_some_one", ["some", "one"])
@Index(["another", "one"], { unique: true })
@Index("idx_some_one", ["some", "one"], { unique: true })
export class UniqueTest {
  @Index({ unique: true })
  @Column({ nullable: true })
  name?: string;

  @Index()
  @Column({ nullable: true })
  some?: string;

  @Column({ nullable: true, unique: true })
  thing?: string;

  @Column({ nullable: true })
  another?: string;

  @Column({ nullable: true })
  one?: string;
}
`;

const expectedFiles = [
  "Model.ts",
  "AddressType.ts",
  "ContactType.ts",
  "Title.ts",
  "Country.ts",
  "Circle.ts",
  "Bio.ts",
  "Address.ts",
  "Contact.ts",
  "UniqueTest.ts",
  "index.ts",
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
  it("should generate entity classes with default naming", () => {
    const files = generateSchema(outDir, {
      schema: [Title, Country, Circle, Bio, Address, Contact, UniqueTest],
    });

    expect(files).toHaveLength(expectedFiles.length);
    expect(files).toEqual(expect.arrayContaining(expectedFiles));

    const code = fs.readFileSync(path.join(outDir, "Contact.ts"), {
      encoding: "utf-8",
    });

    expect(code).toBe(expectedCode);
  });

  it("should generate entity classes with goovee naming", () => {
    generateSchema(outDir, {
      schema: [Title, Country, Circle, Bio, Address, Contact, UniqueTest],
      naming: "goovee",
    });
    const code = fs.readFileSync(path.join(outDir, "Contact.ts"), {
      encoding: "utf-8",
    });

    expect(code).toBe(expectedCodeGooveeNaming);
  });

  it("should generate entity classes with unique constraints", () => {
    generateSchema(outDir, {
      schema: [Title, Country, Circle, Bio, Address, Contact, UniqueTest],
      naming: "goovee",
    });
    const code = fs.readFileSync(path.join(outDir, "UniqueTest.ts"), {
      encoding: "utf-8",
    });
    expect(code).toBe(expectedUniqueCode);
  });
});
