import { type ParseResult } from "../types";

export const cleanResult = (result: ParseResult): ParseResult => {
  const clean = (v: any): any => {
    if (v === undefined || v === null) return v;
    if (v instanceof Date) return v;
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(v)) return v;
    if (Array.isArray(v)) {
      const cleaned = v.map(clean).filter((x) => x !== undefined);
      return cleaned.length === 0 ? undefined : cleaned;
    }
    if (typeof v === "object") {
      const proto = Object.getPrototypeOf(v);
      if (proto === Object.prototype || proto === null) {
        const out: Record<string, any> = {};
        for (const [k, val] of Object.entries(v)) {
          const cleaned = clean(val);
          if (cleaned !== undefined) out[k] = cleaned;
        }
        return Object.keys(out).length === 0 ? undefined : out;
      }
      if (typeof v.toJSON === "function") {
        return v.toJSON();
      }
    }
    return v;
  };
  return (clean(result) || {}) as ParseResult;
};
