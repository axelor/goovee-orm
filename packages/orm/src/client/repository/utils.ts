export const isValueSame = (a: any, b: any): boolean => {
  if (a === null || a === undefined) a = null;
  if (b === null || b === undefined) b = null;
  if (a === b) return true;
  if (a === null || b === null) return false;

  if (a instanceof Date && b instanceof Date) {
    return a.toISOString() === b.toISOString();
  }

  if (a instanceof Buffer && b instanceof Buffer) {
    return a.equals(b);
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => isValueSame(v, b[i]));
  }

  if (typeof a === "object" && typeof b === "object") {
    if ("id" in a && "id" in b) {
      if ("version" in a && "version" in b) {
        return a.id === b.id && a.version === b.version;
      }
      return a.id === b.id;
    }
  }

  return a === b;
};

export const valueOrID = (value: any) =>
  value && typeof value === "object" && "id" in value ? value.id : value;