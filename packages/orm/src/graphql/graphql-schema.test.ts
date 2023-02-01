import { describe, expect, it } from "vitest";
import { defineEntity } from "../schema";
import { buildGraphQLSchema } from "./graphql-schema";

describe("GraphQL schema tests", async () => {
  it("should generate types", async () => {
    const user = defineEntity({
      name: "User",
      fields: [
        {
          name: "name",
          type: "String",
        },
        {
          name: "role",
          type: "ManyToOne",
          target: "Role",
        },
      ],
    });
    const role = defineEntity({
      name: "Role",
      fields: [
        {
          name: "name",
          type: "String",
        },
      ],
    });

    const schema = buildGraphQLSchema([user, role]);
    expect(schema.getType("User")).toBeDefined();
    expect(schema.getType("UserEdge")).toBeDefined();
    expect(schema.getType("UserConnection")).toBeDefined();
    expect(schema.getType("UserFilter")).toBeDefined();
    expect(schema.getType("UserOrder")).toBeDefined();
    expect(schema.getType("UserCreateInput")).toBeDefined();
    expect(schema.getType("UserUpdateInput")).toBeDefined();
    expect(schema.getType("RoleNestedCreateInput")).toBeDefined();
    expect(schema.getType("RoleNestedUpdateInput")).toBeDefined();
  });

  it("should generate enum", async () => {
    const user = defineEntity({
      name: "User",
      fields: [
        {
          name: "name",
          type: "String",
        },
        {
          name: "type",
          type: "Enum",
          enumType: "UserType",
          enumList: [
            {
              name: "EMPLOYEE",
              value: "employee",
            },
            {
              name: "CUSTOMER",
              value: "customer",
            },
          ],
        },
      ],
    });

    const schema = buildGraphQLSchema([user]);
    expect(schema.getType("UserType")).toBeDefined();
  });
});
