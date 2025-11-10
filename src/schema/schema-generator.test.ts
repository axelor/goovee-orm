import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { generateSchema } from "./schema-generator";
import { defineEntity } from "./schema-utils";

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

const SaleOrder = defineEntity({
  name: "SaleOrder",
  synchronize: false,
  fields: [
    {
      name: "taxes",
      type: "ManyToMany",
      target: "SaleTax",
    },
  ],
});

const SaleTax = defineEntity({
  name: "SaleTax",
  synchronize: false,
});

const Temporals = defineEntity({
  name: "Temporals",
  fields: [
    {
      name: "dateTimeField",
      type: "DateTime",
    },
    {
      name: "dateField",
      type: "Date",
    },
    {
      name: "timeField",
      type: "Time",
    },
  ],
});

const Decimals = defineEntity({
  name: "Decimals",
  fields: [
    {
      name: "rate",
      type: "Decimal",
    },
    {
      name: "amount",
      type: "Decimal",
      precision: 10,
      scale: 2,
    },
  ],
});

const NonAuditableEntity = defineEntity({
  name: "NonAuditableEntity",
  auditable: false,
  fields: [
    {
      name: "name",
      type: "String",
      required: true,
    },
  ],
});

const expectedCode = `\
import { Entity, ManyToOne, type Relation, Column, OneToOne, JoinColumn, OneToMany, ManyToMany, JoinTable } from "@goovee/orm/typeorm";
import { AuditableModel } from "./AuditableModel";
import { Title } from "./Title";
import { Bio } from "./Bio";
import { Address } from "./Address";
import { Circle } from "./Circle";
import { ContactType } from "./ContactType";
import { type Text, type Binary, type Json } from "@goovee/orm";

@Entity("contacts")
export class Contact extends AuditableModel {
  @ManyToOne(() => Title)
  title?: Relation<Title> | null;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ nullable: true, type: "date" })
  dateOfBirth?: string | null;

  @Column({ nullable: true })
  Phone?: string | null;

  @Column({ nullable: true })
  email?: string | null;

  @OneToOne(() => Bio, (x) => x.contact)
  @JoinColumn()
  bio?: Relation<Bio> | null;

  @OneToMany(() => Address, (x) => x.contact)
  addresses?: Relation<Address>[] | null;

  @ManyToMany(() => Circle, (x) => x.contacts)
  @JoinTable()
  circles?: Relation<Circle>[] | null;

  @Column({ enum: ContactType, nullable: true, type: "integer", default: ContactType.PARTNER })
  type?: ContactType | null;

  @Column({ nullable: true, type: "text", select: false })
  notes?: Text | null;

  @Column({ nullable: true, type: "oid" as any, select: false })
  photo?: Binary | null;

  @Column({ nullable: true, type: "jsonb", select: false })
  attrs?: Json | null;
}
`;

const expectedCodeGooveeNaming = `\
import { Entity, ManyToOne, type Relation, Column, OneToOne, JoinColumn, OneToMany, ManyToMany, JoinTable } from "@goovee/orm/typeorm";
import { AuditableModel } from "./AuditableModel";
import { Title } from "./Title";
import { Bio } from "./Bio";
import { Address } from "./Address";
import { Circle } from "./Circle";
import { ContactType } from "./ContactType";
import { type Text, type Binary, type Json } from "@goovee/orm";

@Entity("contacts")
export class Contact extends AuditableModel {
  @ManyToOne(() => Title)
  title?: Relation<Title> | null;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ nullable: true, type: "date" })
  dateOfBirth?: string | null;

  @Column({ nullable: true })
  Phone?: string | null;

  @Column({ nullable: true })
  email?: string | null;

  @OneToOne(() => Bio, (x) => x.contact)
  @JoinColumn()
  bio?: Relation<Bio> | null;

  @OneToMany(() => Address, (x) => x.contact)
  addresses?: Relation<Address>[] | null;

  @ManyToMany(() => Circle, (x) => x.contacts)
  @JoinTable({ name: "contacts_circles", joinColumn: { name: "contacts" }, inverseJoinColumn: { name: "circles" } })
  circles?: Relation<Circle>[] | null;

  @Column({ enum: ContactType, nullable: true, type: "integer", default: ContactType.PARTNER })
  type?: ContactType | null;

  @Column({ nullable: true, type: "text", select: false })
  notes?: Text | null;

  @Column({ nullable: true, type: "oid" as any, select: false })
  photo?: Binary | null;

  @Column({ nullable: true, type: "jsonb", select: false })
  attrs?: Json | null;
}
`;

const expectedUniqueCode = `\
import { Entity, Unique, Index, Column } from "@goovee/orm/typeorm";
import { AuditableModel } from "./AuditableModel";

@Entity("unique_test")
@Unique(["some", "thing"])
@Unique("uk_some_one", ["some", "one"])
@Index(["another", "one"], { unique: true })
@Index("idx_some_one", ["some", "one"], { unique: true })
export class UniqueTest extends AuditableModel {
  @Index({ unique: true })
  @Column({ nullable: true })
  name?: string | null;

  @Index()
  @Column({ nullable: true })
  some?: string | null;

  @Column({ nullable: true, unique: true })
  thing?: string | null;

  @Column({ nullable: true })
  another?: string | null;

  @Column({ nullable: true })
  one?: string | null;
}
`;

const expectedSyncCode = `\
import { Entity, ManyToMany, JoinTable, type Relation } from "@goovee/orm/typeorm";
import { AuditableModel } from "./AuditableModel";
import { SaleTax } from "./SaleTax";

@Entity("sale_order", { synchronize: false })
export class SaleOrder extends AuditableModel {
  @ManyToMany(() => SaleTax)
  @JoinTable({ name: "sale_order_taxes", joinColumn: { name: "sale_order" }, inverseJoinColumn: { name: "taxes" }, synchronize: false })
  taxes?: Relation<SaleTax>[] | null;
}
`;

const expectedTemporalsCode = `\
import { Entity, Column } from "@goovee/orm/typeorm";
import { AuditableModel } from "./AuditableModel";

@Entity("temporals")
export class Temporals extends AuditableModel {
  @Column({ nullable: true, type: "timestamp" })
  dateTimeField?: Date | null;

  @Column({ nullable: true, type: "date" })
  dateField?: string | null;

  @Column({ nullable: true, type: "time" })
  timeField?: string | null;
}
`;

const expectedDecimalsCode = `\
import { Entity, Column } from "@goovee/orm/typeorm";
import { AuditableModel } from "./AuditableModel";
import { BigDecimal } from "@goovee/orm";

@Entity("decimals")
export class Decimals extends AuditableModel {
  @Column({ nullable: true, type: "numeric", transformer: (BigDecimal as any).__transformer })
  rate?: BigDecimal | null;

  @Column({ nullable: true, scale: 2, precision: 10, type: "numeric", transformer: (BigDecimal as any).__transformer })
  amount?: BigDecimal | null;
}
`;

const expectedNonAuditableCode = `\
import { Entity, Column } from "@goovee/orm/typeorm";
import { Model } from "./Model";

@Entity("non_auditable_entity")
export class NonAuditableEntity extends Model {
  @Column()
  name!: string;
}
`;

const outDir = path.join("node_modules", "code-gen");

const schema = [
  Title,
  Country,
  Circle,
  Bio,
  Address,
  Contact,
  SaleOrder,
  SaleTax,
  UniqueTest,
  Temporals,
  Decimals,
  NonAuditableEntity,
];

const expectedFiles = [
  "Model.ts",
  "AuditableModel.ts",
  "AddressType.ts",
  "ContactType.ts",
  "Title.ts",
  "Country.ts",
  "Circle.ts",
  "Bio.ts",
  "Address.ts",
  "Contact.ts",
  "SaleOrder.ts",
  "SaleTax.ts",
  "UniqueTest.ts",
  "Temporals.ts",
  "Decimals.ts",
  "NonAuditableEntity.ts",
  "index.ts",
].map((x) => path.join(outDir, x));

const cleanUp = () => {
  fs.rmSync(outDir, { recursive: true, force: true });
};

describe("schema generator tests", () => {
  afterEach(cleanUp);
  it("should generate entity classes with default naming", () => {
    const files = generateSchema(outDir, { schema });

    expect(files).toHaveLength(expectedFiles.length);
    expect(files).toEqual(expect.arrayContaining(expectedFiles));

    const code = fs.readFileSync(path.join(outDir, "Contact.ts"), {
      encoding: "utf-8",
    });

    expect(code).toBe(expectedCode);
  });

  it("should generate entity classes with goovee naming", () => {
    generateSchema(outDir, {
      schema,
      naming: "goovee",
    });
    const code = fs.readFileSync(path.join(outDir, "Contact.ts"), {
      encoding: "utf-8",
    });

    expect(code).toBe(expectedCodeGooveeNaming);
  });

  it("should generate entity classes with unique constraints", () => {
    generateSchema(outDir, {
      schema,
      naming: "goovee",
    });
    const code = fs.readFileSync(path.join(outDir, "UniqueTest.ts"), {
      encoding: "utf-8",
    });
    expect(code).toBe(expectedUniqueCode);
  });

  it("should generate entity classes with sync disabled", () => {
    generateSchema(outDir, {
      schema,
      naming: "goovee",
    });
    const code = fs.readFileSync(path.join(outDir, "SaleOrder.ts"), {
      encoding: "utf-8",
    });
    expect(code).toBe(expectedSyncCode);
  });

  it("should generate proper temporal types", () => {
    generateSchema(outDir, {
      schema,
      naming: "goovee",
    });
    const code = fs.readFileSync(path.join(outDir, "Temporals.ts"), {
      encoding: "utf-8",
    });
    expect(code).toBe(expectedTemporalsCode);
  });

  it("should generate proper decimal types", () => {
    generateSchema(outDir, {
      schema,
      naming: "goovee",
    });
    const code = fs.readFileSync(path.join(outDir, "Decimals.ts"), {
      encoding: "utf-8",
    });
    expect(code).toBe(expectedDecimalsCode);
  });

  it("should generate non-auditable entity extending Model instead of AuditableModel", () => {
    generateSchema(outDir, {
      schema,
      naming: "goovee",
    });
    const code = fs.readFileSync(path.join(outDir, "NonAuditableEntity.ts"), {
      encoding: "utf-8",
    });
    expect(code).toBe(expectedNonAuditableCode);
  });
});
