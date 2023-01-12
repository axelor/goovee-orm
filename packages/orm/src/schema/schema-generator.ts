import fs from "node:fs";
import path from "node:path";

import { camelCase, snakeCase } from "typeorm/util/StringUtils";
import { defineEntity } from ".";

import { Class } from "../code-generator/Class";
import { CodeFile } from "../code-generator/CodeFile";
import { Decorator } from "../code-generator/Decorator";
import { Emittable } from "../code-generator/Emittable";
import { Enum } from "../code-generator/Enum";
import { ImportName } from "../code-generator/ImportName";
import { Method } from "../code-generator/Method";
import { Variable } from "../code-generator/Variable";
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

const toSnakeCase = (name: string) => snakeCase(name);
const toCamelCase = (name: string, firstUpper?: boolean) => {
  const res = camelCase(name);
  return firstUpper ? res[0].toUpperCase() + res.slice(1) : res;
};

const newDecorator = (name: string) => {
  const imp = new ImportName(name, "typeorm");
  const dec = new Decorator(imp);
  return dec;
};

const Types: Record<string, string> = {
  String: "string",
  Boolean: "boolean",
  Int: "number",
  BigInt: "string",
  Date: "Date",
  Time: "Date",
  DateTime: "Date",
  Binary: "string",
  Decimal: "string",
  Text: "string",
  JSON: "string",
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

  protected get actualType(): string | ImportName {
    const { type } = this.options;
    return Types[type] ?? type;
  }

  protected decorators(options: P) {
    const {
      primary,
      version,
      column,
      required,
      default: defaultValue,
      size: length,
      scale,
      precision,
      auditColumn,
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

    return [newDecorator(decorator).arg(arg)];
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
    const { selectionList, enumType, default: defaultValue } = options;
    const decorator = newDecorator("Column");
    const args: Record<string, any> = {
      enum: decorator.unquote(enumType),
    };

    if (typeof selectionList?.[0]?.value === "number") {
      args.type = "integer";
    } else {
      args.type = "varchar";
      args.length = 255;
    }

    let defaultItem = selectionList.find(
      (item) => item.name === defaultValue || item.value === defaultValue
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
    super.emit(file);
    if (this.collection) {
      file.write("[]");
    }
  }
}

class RelationalField<
  T extends PropertyOptions & IRelational
> extends FieldGenerator<T> {
  protected get actualType() {
    const { type, target } = this.options;
    const collection = type.endsWith("ToMany");
    return new RelationImportName(collection, target, `./${target}`);
  }
}

class OneToOneFieldGenerator extends RelationalField<OneToOneProperty> {
  protected decorators(options: OneToOneProperty) {
    const { name, target, mappedBy, column } = options;
    const m = newDecorator("OneToOne").arg(`() => ${target}`);

    if (mappedBy) {
      m.arg(`(x) => x.${mappedBy}`);
      return [m];
    }

    const j = newDecorator("JoinColumn").arg({
      name: column ?? toSnakeCase(name),
    });

    return [m, j];
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
    const { target, mappedBy } = options;
    const m = newDecorator("OneToMany")
      .arg(`() => ${target}`)
      .arg(`(x) => x.${mappedBy}`);
    return [m];
  }
}

class ManyToManyFieldGenerator extends RelationalField<ManyToManyProperty> {
  protected decorators(options: ManyToManyProperty) {
    const { target, mappedBy } = options;
    const { name, table, column, inverseColumn } = options;
    const { entity } = this;

    const m = newDecorator("ManyToMany").arg(`() => ${target}`);
    const j = newDecorator("JoinTable");

    if (mappedBy) {
      m.arg(`(x) => x.${mappedBy}`);
    }

    j.arg({
      name: table ?? `${entity.table}_${toSnakeCase(name)}`,
      joinColumn: { name: column ?? entity.table },
      inverseJoinColumn: { name: inverseColumn ?? toSnakeCase(name) },
    });

    return mappedBy ? [m] : [m, j];
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

class EntityGenerator implements CodeGenerator {
  private options: EntityOptions;

  constructor(options: EntityOptions) {
    this.options = options;
  }

  get isAbstract() {
    return this.options.abstract;
  }

  get name() {
    return this.options.name;
  }

  get table() {
    return this.options.table ?? toSnakeCase(this.name);
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
    const { name, table, options } = this;
    const { fields = [] } = options;

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
  type: EntityGenerator | EnumGenerator | IndexGenerator
) => {
  const fileName = `${type.name}.ts`;
  const file = new CodeFile(fileName);
  const generator = type.toCode(file);

  generator.emit(file);

  const out = file.toJSON();
  const outFile = path.join(outDir, fileName);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, out, { encoding: "utf-8" });

  return fileName;
};

const generateEnum = (outDir: string, options: EnumProperty) => {
  const { enumType, selectionList } = options;
  const type = new EnumGenerator(enumType, selectionList);
  return save(outDir, type);
};

const generateEntity = (outDir: string, options: EntityOptions) => {
  const type = new EntityGenerator(options);
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

export const readSchema = (schemaDir: string) => {
  const schema = fs
    .readdirSync(schemaDir, { withFileTypes: true })
    .filter((x) => /\.(ts|json)$/.test(x.name))
    .map((x) => path.join(schemaDir, x.name))
    .map((x) => path.resolve(x))
    .map((x) => (x.endsWith(".json") ? require(x) : require(x).default));
  return schema;
};

export const generateSchema = (outDir: string, schema: EntityOptions[]) => {
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
  files.push(generateEntity(outDir, model));

  // find enums
  const enums = schema
    .flatMap((x) => x.fields)
    .filter((x) => x?.type === "Enum");

  for (const field of enums) {
    files.push(generateEnum(outDir, field as any));
  }

  // generate all other entities
  for (const opts of schema) {
    if (opts.name !== Model.name) {
      files.push(generateEntity(outDir, opts));
    }
  }

  // generate index.ts
  const names = files.map((x) => x.replace(".ts", ""));
  files.push(generateIndex(outDir, names));

  return files;
};
