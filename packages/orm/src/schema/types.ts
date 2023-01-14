export interface Property {
  name: string;
  type: string;
  title?: string;
  help?: string;
}

export interface SimpleProperty extends Property {
  column?: string;
  required?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  default?: string | boolean | number;
  unique?: boolean;
  nullable?: boolean;
  computed?: boolean;
  body?: string[];
}

export interface SelectionItem {
  value: string | number;
  title?: string;
}

export interface ISelection {
  selection?: string;
  selectionList?: SelectionItem[];
}

export interface IEncryptable {
  encrypted?: boolean;
}

export interface ITranslatable {
  translatable?: boolean;
}

export interface IPrimary {
  primary?: boolean;
}

export interface StringProperty
  extends SimpleProperty,
    ITranslatable,
    IEncryptable,
    ISelection,
    IPrimary {
  type: "String";
  nameColumn?: boolean;
  nameSearch?: string;
  password?: boolean;
  size?: number;
  sequence?: boolean;
}

export interface NumberProperty extends SimpleProperty, IPrimary {
  type: "Int" | "BigInt";
  version?: boolean;
}

export interface BooleanProperty extends SimpleProperty {
  type: "Boolean";
}

export interface DateProperty extends SimpleProperty {
  type: "Date";
}

export interface TimeProperty extends SimpleProperty {
  type: "Time";
}

export interface DateTimeProperty extends SimpleProperty {
  type: "DateTime";
  auditColumn?: "CreateDate" | "UpdateDate";
}

export interface TextProperty
  extends SimpleProperty,
    ITranslatable,
    IEncryptable {
  type: "Text";
}

export interface JsonProperty extends SimpleProperty {
  type: "JSON";
}

export interface EnumItem {
  name: string;
  value: string | number;
  title?: string;
}

export interface EnumProperty extends SimpleProperty {
  type: "Enum";
  enumType: string;
  enumList: EnumItem[];
}

export interface DecimalProperty extends SimpleProperty {
  type: "Decimal";
  precision?: number;
  scale?: number;
}

export interface BinaryProperty extends SimpleProperty {
  type: "Binary";
}

export interface IRelational {
  target: string;
  targetName?: string;
  targetSearch?: string[];
}

export interface OneToOneProperty extends SimpleProperty, IRelational {
  type: "OneToOne";
  mappedBy?: string;
  orphanRemoval?: boolean;
}

export interface ManyToOneProperty extends SimpleProperty, IRelational {
  type: "ManyToOne";
  auditColumn?: "CreateUser" | "UpdateUser";
}

export interface OneToManyProperty extends Property, IRelational {
  type: "OneToMany";
  mappedBy: string;
  orphanRemoval?: boolean;
}

export interface ManyToManyProperty extends Property, IRelational {
  type: "ManyToMany";
  mappedBy?: string;
  table?: string;
  column?: string;
  inverseColumn?: string;
}

export type PropertyOptions =
  | StringProperty
  | NumberProperty
  | DecimalProperty
  | BooleanProperty
  | DateProperty
  | TimeProperty
  | DateTimeProperty
  | TextProperty
  | JsonProperty
  | BinaryProperty
  | EnumProperty
  | OneToOneProperty
  | ManyToOneProperty
  | OneToManyProperty
  | ManyToManyProperty;

export interface EntityOptions {
  name: string;
  table?: string;
  abstract?: boolean;
  extends?: string;
  implements?: string | string[];
  fields?: PropertyOptions[];
}
