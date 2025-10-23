import { ValueTransformer } from "typeorm";

export const DateTransformer: ValueTransformer = {
  from: (value) => {
    if (value instanceof Date) return value;
    if (typeof value === "string") {
      return value.includes("T")
        ? new Date(value)
        : new Date(value + "T00:00:00Z");
    }
    return value;
  },
  to: (value) => {
    if (value instanceof Date) {
      const yyyy = value.getFullYear();
      const mm = String(value.getMonth() + 1).padStart(2, "0");
      const dd = String(value.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
    return value;
  },
};
