import fs from "node:fs";
import path from "node:path";

import { Class } from "../code-generator/Class";
import { CodeFile } from "../code-generator/CodeFile";
import { Decorator } from "../code-generator/Decorator";
import { Emittable } from "../code-generator/Emittable";
import { Enum } from "../code-generator/Enum";
import { ImportName } from "../code-generator/ImportName";
import { Method } from "../code-generator/Method";
import { Variable } from "../code-generator/Variable";
import { defineEntity, toCamelCase, toSnakeCase } from "./schema-utils";
import {
  EntityOptions,
  EnumItem,
  EnumProperty,
  IRelational,
  ManyToManyProperty,
  ManyToOneProperty,
  OneToManyProperty,
  OneToOneProperty,
  PropertyOptions,
  SimpleProperty,
} from "./types";

const newDecorator = (name: string) => {
  const imp = new ImportName(name, "@goovee/orm/typeorm");
  const dec = new Decorator(imp);
  return dec;
};

const Types: Record<string, string> = {
  String: "string",
  Boolean: "boolean",
  Int: "number",
  BigInt: "string",
  Date: "string",
  Time: "string",
  DateTime: "Date",
  Decimal: "BigDecimal",
  Binary: "Binary",
  Text: "Text",
  JSON: "Json",
};

interface CodeGenerator {
  toCode(file: CodeFile): Emittable;
}

class FieldGenerator<P extends PropertyOptions = PropertyOptions>
  implements CodeGenerator
{
  protected readonly entity: EntityGenerator;
  protected readonly options: P;

  constructor(entity: EntityGenerator, options: P) {
    this.entity = entity;
    this.options = options;
  }

  protected importNameInternal(name: string) {
    const modName = "@goovee/orm";
    return new ImportName(name, modName);
  }

  protected get actualType(): string | ImportName {
    const { type } = this.options;
    if (type === "JSON") return this.importNameInternal("type Json");
    if (type === "Text") return this.importNameInternal("type Text");
    if (type === "Binary") return this.importNameInternal("type Binary");
    if (type === "Decimal") return this.importNameInternal("BigDecimal");
    return Types[type] ?? type;
  }

  protected decorators(options: P) {
    const {
      type,
      primary,
      version,
      column,
      required,
      default: defaultValue,
      size: length,
      scale,
      precision,
      auditColumn,
      index,
      unique,
    } = options as any;

    const arg: Record<string, any> = {
      name: column,
      nullable: required ? undefined : true,
      default: defaultValue,
      length,
      scale,
      precision,
    };

    if (primary) {
      return [newDecorator("PrimaryColumn").arg({ type: "bigint" })];
    }

    let decorator = "Column";

    if (version) decorator = "VersionColumn";
    if (auditColumn === "CreateDate") decorator = "CreateDateColumn";
    if (auditColumn === "UpdateDate") decorator = "UpdateDateColumn";

    const d = newDecorator(decorator);

    // primitive types
    if (type === "String") arg.type = "varchar";
    if (type === "Int") arg.type = "integer";
    if (type === "BigInt") arg.type = "bigint";
    if (type === "Boolean") arg.type = "boolean";

    if (decorator === "Column" && ["JSON", "Text", "Binary"].includes(type)) {
      if (type === "Text") arg.type = "text";
      if (type === "JSON") arg.type = "jsonb";
      if (type === "Binary") arg.type = d.unquote('"oid" as any');
      arg.select = false;
    }

    // temporal types
    if (type === "DateTime") arg.type = "timestamp";
    if (type === "Date") arg.type = "date";
    if (type === "Time") arg.type = "time";

    // decimal type
    if (type === "Decimal") {
      arg.type = "numeric";
      arg.transformer = d.unquote("(BigDecimal as any).__transformer");
    }

    const decorators: Decorator[] = [];

    if (index) {
      const decorator = newDecorator("Index");
      if (typeof index === "string") decorator.arg(index);
      if (unique) decorator.arg({ unique: true });
      decorators.push(decorator);
    }

    if (unique && decorator === "Column" && !index) {
      arg.unique = true;
    }

    decorators.push(d.arg(arg));

    return decorators;
  }

  toCode(file: CodeFile) {
    const opts = this.options as any;
    const { name } = this.options;
    const { auditColumn, required, readonly = !!auditColumn } = opts;

    const type = this.actualType;
    const modifier = readonly && "readonly";

    const field = new Variable(name, {
      type,
      required,
      modifier,
      field: true,
    });

    for (const decorator of this.decorators(this.options)) {
      field.decorator(decorator);
    }

    return field;
  }
}

class EnumFieldGenerator extends FieldGenerator<EnumProperty> {
  protected get actualType() {
    const { enumType } = this.options;
    return new ImportName(enumType, `./${enumType}`);
  }

  protected decorators(options: EnumProperty) {
    const { required, enumType, enumList, default: defaultValue } = options;
    const decorator = newDecorator("Column");
    const args: Record<string, any> = {
      enum: decorator.unquote(enumType),
    };

    if (!required) {
      args.nullable = true;
    }

    if (typeof enumList?.[0]?.value === "number") {
      args.type = "integer";
    } else {
      args.type = "varchar";
      args.length = 255;
    }

    let defaultItem = enumList.find(
      (item) => item.name === defaultValue || item.value === defaultValue,
    );
    if (defaultItem) {
      args.default = decorator.unquote(`${enumType}.${defaultItem.name}`);
    }

    return [decorator.arg(args)];
  }
}

class RelationImportName extends ImportName {
  private collection;
  constructor(collection: boolean, name: string, module: string) {
    super(name, module);
    this.collection = collection;
  }
  emit(file: CodeFile): void {
    const relationType = new ImportName("type Relation", "@goovee/orm/typeorm");
    file.write(relationType).write("<");
    super.emit(file);
    file.write(">");
    if (this.collection) {
      file.write("[]");
    }
  }
}

class RelationalField<
  T extends PropertyOptions & IRelational,
> extends FieldGenerator<T> {
  protected get actualType() {
    const { type, target } = this.options;
    const collection = type.endsWith("ToMany");
    return new RelationImportName(collection, target, `./${target}`);
  }
  protected get inverseRelation() {
    const { name, type, target } = this.options;
    const inverse = this.entity.config.schema
      .find((x) => x.name === target)
      ?.fields?.find((x: any) => x.type === type && x.mappedBy == name);
    return inverse;
  }
}

class OneToOneFieldGenerator extends RelationalField<OneToOneProperty> {
  protected decorators(options: OneToOneProperty) {
    const { name, column, target, mappedBy } = options;
    const m = newDecorator("OneToOne").arg(`() => ${target}`);

    if (mappedBy) {
      m.arg(`(x) => x.${mappedBy}`);
      return [m];
    }

    const c = newDecorator("JoinColumn");
    if (column) {
      c.arg({ name: column });
    }

    // if there is any bi-directional one-to-one defined
    const inverse = this.inverseRelation;
    if (inverse) {
      m.arg(`(x) => x.${inverse.name}`);
    }

    return [m, c];
  }
}

class ManyToOneFieldGenerator extends RelationalField<ManyToOneProperty> {
  protected decorators(options: ManyToOneProperty) {
    const { target, column } = options;

    const t = `() => ${target}`;
    const m = newDecorator("ManyToOne").arg(t);

    if (column) {
      const c = newDecorator("JoinColumn").arg({ name: column });
      return [m, c];
    }

    return [m];
  }
}

class OneToManyFieldGenerator extends RelationalField<OneToManyProperty> {
  protected decorators(options: OneToManyProperty) {
    const { name, target, mappedBy } = options;
    if (mappedBy) {
      const m = newDecorator("OneToMany")
        .arg(`() => ${target}`)
        .arg(`(x) => x.${mappedBy}`);
      return [m];
    }

    const { entity } = this;
    const m = newDecorator("OneToMany").arg(`() => ${target}`);

    if (entity.config.naming === "goovee") {
      const table = `${entity.table}_${toSnakeCase(name)}`;
      const column = entity.table;
      const inverseColumn = toSnakeCase(name);

      const j = newDecorator("JoinTable");
      const jarg: any = {};

      if (table) jarg.name = table;
      if (column) jarg.joinColumn = { name: column };
      if (inverseColumn) jarg.inverseJoinColumn = { name: inverseColumn };
      if (entity.synchronize === false) jarg.synchronize = false;

      j.arg(jarg);
      return [m, j];
    }

    return [m];
  }
}

class ManyToManyFieldGenerator extends RelationalField<ManyToManyProperty> {
  protected decorators(options: ManyToManyProperty) {
    const { name, target, mappedBy } = options;
    const { entity } = this;
    const m = newDecorator("ManyToMany").arg(`() => ${target}`);

    if (mappedBy) {
      m.arg(`(x) => x.${mappedBy}`);
      return [m];
    }

    let { table, column, inverseColumn } = options;
    if (entity.config.naming === "goovee") {
      table = table ?? `${entity.table}_${toSnakeCase(name)}`;
      column =
        column ??
        (this.inverseRelation
          ? toSnakeCase(this.inverseRelation.name)
          : entity.table);
      inverseColumn = inverseColumn ?? toSnakeCase(name);
    }

    const j = newDecorator("JoinTable");

    if (table || column || inverseColumn) {
      const jarg: any = {};
      if (table) jarg.name = table;
      if (column) jarg.joinColumn = { name: column };
      if (inverseColumn) jarg.inverseJoinColumn = { name: inverseColumn };
      if (entity.synchronize === false) jarg.synchronize = false;
      j.arg(jarg);
    }

    // if there is any bi-directional many-to-many defined
    const inverse = this.inverseRelation;
    if (inverse) {
      m.arg(`(x) => x.${inverse.name}`);
    }

    return [m, j];
  }
}

const Fields: Record<PropertyOptions["type"], any> = {
  String: FieldGenerator,
  Int: FieldGenerator,
  BigInt: FieldGenerator,
  Decimal: FieldGenerator,
  Boolean: FieldGenerator,
  Date: FieldGenerator,
  Time: FieldGenerator,
  DateTime: FieldGenerator,
  Text: FieldGenerator,
  JSON: FieldGenerator,
  Binary: FieldGenerator,
  Enum: EnumFieldGenerator,
  OneToOne: OneToOneFieldGenerator,
  ManyToOne: ManyToOneFieldGenerator,
  OneToMany: OneToManyFieldGenerator,
  ManyToMany: ManyToManyFieldGenerator,
};

class EnumGenerator implements CodeGenerator {
  #name;
  #items;

  constructor(name: string, items: EnumItem[]) {
    this.#name = name;
    this.#items = items;
  }

  get name() {
    return this.#name;
  }

  toCode(file: CodeFile) {
    const type = new Enum(this.name, {
      export: true,
    });

    for (const { name, value } of this.#items) {
      type.enum(name, value);
    }

    return type;
  }
}

export type GeneratorConfig = {
  schema: EntityOptions[];
  naming?: "goovee" | "default";
};

class EntityGenerator implements CodeGenerator {
  private options: EntityOptions;

  readonly config: GeneratorConfig;

  constructor(options: EntityOptions, config: GeneratorConfig) {
    this.options = options;
    this.config = config;
  }

  get name() {
    return this.options.name;
  }

  get table() {
    if (this.options.table) return this.options.table;
    if (this.config.naming === "goovee") return toSnakeCase(this.name);
  }

  get synchronize() {
    return this.options.synchronize;
  }

  private toComputed(field: SimpleProperty) {
    const { name, body: lines = [] } = field;
    const body = lines.join("\n").trim();

    if (!body) {
      throw new Error(`Field ${name} is computed but no 'body' defined.`);
    }

    const methodName = `compute${toCamelCase(name, true)}`;
    const method = new Method(methodName, {
      visibility: "protected",
    });

    method.line(`this.${name} = (() => {`);
    method.line(body);
    method.line("})();");

    method.decorator(newDecorator("BeforeInsert"));
    method.decorator(newDecorator("BeforeUpdate"));

    return method;
  }

  private get extends() {
    let name = this.options.extends;
    if (name) return new ImportName(name, `./${name}`);
  }

  private get implements() {
    let types = this.options.implements;
    if (types) {
      if (typeof types === "string") types = [types];
      return types.map((name: string) => new ImportName(name, `./${name}`));
    }
  }

  toCode(file: CodeFile) {
    const { name, table, synchronize, options } = this;
    const { fields = [], uniques = [], indexes = [] } = options;

    const entity = new Class(name, {
      export: true,
      extends: this.extends,
      implements: this.implements,
      abstract: options.abstract,
    });

    if (!options.abstract) {
      const decorator = entity.decorator(newDecorator("Entity"));
      if (table) {
        decorator.arg(table);
      }
      if (synchronize === false) {
        decorator.arg({ synchronize });
      }
    }

    for (const unique of uniques) {
      const decorator = entity.decorator(newDecorator("Unique"));
      if (unique.name) decorator.arg(unique.name);
      decorator.arg(unique.columns);
    }
    for (const index of indexes) {
      const decorator = entity.decorator(newDecorator("Index"));
      if (index.name) decorator.arg(index.name);
      decorator.arg(index.columns);
      if (index.unique)
        decorator.arg({
          unique: true,
        });
    }

    for (const field of fields) {
      const props = field as any;
      const Generator = Fields[field.type];
      const generator = new Generator(this, props) as FieldGenerator;
      const prop = generator.toCode(file);

      entity.field(prop);

      if (props.computed) {
        const method = this.toComputed(props);
        entity.method(method);
      }
    }

    return entity;
  }
}

class IndexGenerator implements CodeGenerator {
  private names;

  constructor(names: string[]) {
    this.names = names;
  }

  get name() {
    return "index";
  }

  toCode(): Emittable {
    return {
      emit: (file) => {
        for (const name of this.names) {
          file.write(`export { ${name} } from "./${name}";`);
          file.write("\n");
        }
      },
    };
  }
}

const save = (
  outDir: string,
  type: EntityGenerator | EnumGenerator | IndexGenerator,
) => {
  const fileName = `${type.name}.ts`;
  const file = new CodeFile(fileName);
  const generator = type.toCode(file);

  generator.emit(file);

  const out = file.toJSON();
  const outFile = path.join(outDir, fileName);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, out, { encoding: "utf-8" });

  return outFile;
};

const generateEnum = (outDir: string, options: EnumProperty) => {
  const { enumType, enumList } = options;
  const type = new EnumGenerator(enumType, enumList);
  return save(outDir, type);
};

const generateEntity = (
  outDir: string,
  options: EntityOptions,
  config: GeneratorConfig,
) => {
  const type = new EntityGenerator(options, config);
  return save(outDir, type);
};

const generateIndex = (outDir: string, names: string[]) => {
  const type = new IndexGenerator(names);
  return save(outDir, type);
};

const Model = defineEntity({
  name: "Model",
  abstract: true,
  fields: [
    {
      name: "id",
      type: "BigInt",
      primary: true,
    },
    {
      name: "version",
      type: "Int",
      version: true,
    },
  ],
});

const AuditableModel = defineEntity({
  name: "AuditableModel",
  abstract: true,
  extends: "Model",
  fields: [
    {
      name: "createdOn",
      type: "DateTime",
      auditColumn: "CreateDate",
    },
    {
      name: "updatedOn",
      type: "DateTime",
      auditColumn: "UpdateDate",
    },
  ],
});

export const generateSchema = (outDir: string, config: GeneratorConfig) => {
  const { schema } = config;
  let model = schema.find((x) => x.name === "Model");
  if (model) {
    const fields = [...(Model.fields ?? [])];
    for (const field of model.fields ?? []) {
      const found = fields.find((x) => x.name === field.name);
      if (found) {
        throw new Error(`Can't override Model field: ${field.name}`);
      }
      fields.push(field);
    }

    let _extends = model.extends ?? Model.extends;
    let _implements = [
      ...(Model.implements ?? []),
      ...(model.implements ?? []),
    ].filter(Boolean);

    model = {
      ...Model,
      extends: _extends,
      implements: _implements.length ? [..._implements] : undefined,
      fields,
    };
  } else {
    model = Model;
  }

  const files = [];

  // generate base model
  files.push(generateEntity(outDir, model, config));

  // generate auditable model
  files.push(generateEntity(outDir, AuditableModel, config));

  // find enums
  const enums = schema
    .flatMap((x) => x.fields)
    .filter((x) => x?.type === "Enum");

  for (const field of enums) {
    files.push(generateEnum(outDir, field as any));
  }

  // generate all other entities
  for (const opts of schema) {
    if (opts.name !== Model.name && opts.name !== AuditableModel.name) {
      const auditable =
        opts.extends === "AuditableModel" || opts.auditable !== false;
      const extendsValue =
        opts.extends === "Model" && auditable
          ? AuditableModel.name
          : opts.extends || (auditable ? AuditableModel.name : Model.name);

      files.push(
        generateEntity(
          outDir,
          { ...opts, extends: extendsValue, auditable },
          config,
        ),
      );
    }
  }

  // generate index.ts
  const names = files
    .map((x) => path.basename(x))
    .map((x) => x.replace(".ts", ""));
  files.push(generateIndex(outDir, names));

  return files;
};
