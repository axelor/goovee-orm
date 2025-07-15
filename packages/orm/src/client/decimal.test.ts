import { describe, expect, it } from "vitest";
import { BigDecimal, RoundingMode } from "./decimal";

describe("BigDecimal", () => {
  describe("Constructor", () => {
    it("should create from string", () => {
      const bd = new BigDecimal("123.45");
      expect(bd.toString()).toBe("123.45");
    });

    it("should create from number", () => {
      const bd = new BigDecimal(123.45);
      expect(bd.toString()).toBe("123.45");
    });

    it("should create from bigint", () => {
      const bd = new BigDecimal(123n);
      expect(bd.toString()).toBe("123");
    });

    it("should create from unscaled value and scale", () => {
      const bd = new BigDecimal(12345n, 2);
      expect(bd.toString()).toBe("123.45");
    });

    it("should handle negative values", () => {
      expect(new BigDecimal("-123.45").toString()).toBe("-123.45");
      expect(new BigDecimal(-123.45).toString()).toBe("-123.45");
      expect(new BigDecimal(-123n).toString()).toBe("-123");
      expect(new BigDecimal(-12345n, 2).toString()).toBe("-123.45");
    });

    it("should handle zero", () => {
      expect(new BigDecimal("0").toString()).toBe("0");
      expect(new BigDecimal(0).toString()).toBe("0");
      expect(new BigDecimal(0n).toString()).toBe("0");
    });

    it("should handle decimal-only values", () => {
      expect(new BigDecimal("0.123").toString()).toBe("0.123");
      expect(new BigDecimal(".123").toString()).toBe("0.123");
    });

    it("should throw on invalid format", () => {
      expect(() => new BigDecimal("123.45.67")).toThrow(
        "Invalid number format",
      );
    });
  });

  describe("Static Constants", () => {
    it("should have ZERO constant", () => {
      expect(BigDecimal.ZERO.toString()).toBe("0");
    });

    it("should have ONE constant", () => {
      expect(BigDecimal.ONE.toString()).toBe("1");
    });

    it("should have TEN constant", () => {
      expect(BigDecimal.TEN.toString()).toBe("10");
    });
  });

  describe("Arithmetic Operations", () => {
    describe("add", () => {
      it("should add two positive numbers", () => {
        const a = new BigDecimal("123.45");
        const b = new BigDecimal("67.89");
        expect(a.add(b).toString()).toBe("191.34");
      });

      it("should add positive and negative numbers", () => {
        const a = new BigDecimal("123.45");
        const b = new BigDecimal("-67.89");
        expect(a.add(b).toString()).toBe("55.56");
      });

      it("should add numbers with different scales", () => {
        const a = new BigDecimal("123.4");
        const b = new BigDecimal("67.89");
        expect(a.add(b).toString()).toBe("191.29");
      });

      it("should add integer and decimal", () => {
        const a = new BigDecimal("123");
        const b = new BigDecimal("0.45");
        expect(a.add(b).toString()).toBe("123.45");
      });
    });

    describe("subtract", () => {
      it("should subtract two positive numbers", () => {
        const a = new BigDecimal("123.45");
        const b = new BigDecimal("67.89");
        expect(a.subtract(b).toString()).toBe("55.56");
      });

      it("should subtract resulting in negative", () => {
        const a = new BigDecimal("67.89");
        const b = new BigDecimal("123.45");
        expect(a.subtract(b).toString()).toBe("-55.56");
      });

      it("should subtract with different scales", () => {
        const a = new BigDecimal("123.4");
        const b = new BigDecimal("67.89");
        expect(a.subtract(b).toString()).toBe("55.51");
      });
    });

    describe("multiply", () => {
      it("should multiply two positive numbers", () => {
        const a = new BigDecimal("123.45");
        const b = new BigDecimal("67.89");
        expect(a.multiply(b).toString()).toBe("8381.0205");
      });

      it("should multiply positive and negative", () => {
        const a = new BigDecimal("123.45");
        const b = new BigDecimal("-67.89");
        expect(a.multiply(b).toString()).toBe("-8381.0205");
      });

      it("should multiply by zero", () => {
        const a = new BigDecimal("123.45");
        const b = new BigDecimal("0");
        expect(a.multiply(b).toString()).toBe("0");
      });

      it("should multiply integers", () => {
        const a = new BigDecimal("123");
        const b = new BigDecimal("456");
        expect(a.multiply(b).toString()).toBe("56088");
      });
    });

    describe("divide", () => {
      it("should divide two numbers", () => {
        const a = new BigDecimal("123.45");
        const b = new BigDecimal("67.89");
        expect(a.divide(b, 4).toString()).toBe("1.8184");
      });

      it("should divide with default scale", () => {
        const a = new BigDecimal("10");
        const b = new BigDecimal("3");
        expect(a.divide(b).toString()).toBe("3");
      });

      it("should divide with higher scale", () => {
        const a = new BigDecimal("10");
        const b = new BigDecimal("3");
        expect(a.divide(b, 5).toString()).toBe("3.33333");
      });

      it("should throw on division by zero", () => {
        const a = new BigDecimal("123.45");
        const b = new BigDecimal("0");
        expect(() => a.divide(b)).toThrow("Division by zero");
      });

      it("should handle exact division", () => {
        const a = new BigDecimal("100");
        const b = new BigDecimal("4");
        expect(a.divide(b).toString()).toBe("25");
      });
    });
  });

  describe("Rounding Modes", () => {
    it("HALF_UP rounding", () => {
      const a = new BigDecimal("123.456");
      expect(a.setScale(2, RoundingMode.HALF_UP).toString()).toBe("123.46");
      expect(
        new BigDecimal("123.455").setScale(2, RoundingMode.HALF_UP).toString(),
      ).toBe("123.46");
      expect(
        new BigDecimal("123.454").setScale(2, RoundingMode.HALF_UP).toString(),
      ).toBe("123.45");
    });

    it("HALF_DOWN rounding", () => {
      const a = new BigDecimal("123.456");
      expect(a.setScale(2, RoundingMode.HALF_DOWN).toString()).toBe("123.46");
      expect(
        new BigDecimal("123.455")
          .setScale(2, RoundingMode.HALF_DOWN)
          .toString(),
      ).toBe("123.45");
    });

    it("UP rounding", () => {
      expect(
        new BigDecimal("123.451").setScale(2, RoundingMode.UP).toString(),
      ).toBe("123.46");
      expect(
        new BigDecimal("-123.451").setScale(2, RoundingMode.UP).toString(),
      ).toBe("-123.46");
    });

    it("DOWN rounding", () => {
      expect(
        new BigDecimal("123.459").setScale(2, RoundingMode.DOWN).toString(),
      ).toBe("123.45");
      expect(
        new BigDecimal("-123.459").setScale(2, RoundingMode.DOWN).toString(),
      ).toBe("-123.45");
    });

    it("CEILING rounding", () => {
      expect(
        new BigDecimal("123.451").setScale(2, RoundingMode.CEILING).toString(),
      ).toBe("123.46");
      expect(
        new BigDecimal("-123.451").setScale(2, RoundingMode.CEILING).toString(),
      ).toBe("-123.45");
    });

    it("FLOOR rounding", () => {
      expect(
        new BigDecimal("123.459").setScale(2, RoundingMode.FLOOR).toString(),
      ).toBe("123.45");
      expect(
        new BigDecimal("-123.451").setScale(2, RoundingMode.FLOOR).toString(),
      ).toBe("-123.46");
    });

    it("HALF_EVEN rounding", () => {
      expect(
        new BigDecimal("123.455")
          .setScale(2, RoundingMode.HALF_EVEN)
          .toString(),
      ).toBe("123.46");
      expect(
        new BigDecimal("123.445")
          .setScale(2, RoundingMode.HALF_EVEN)
          .toString(),
      ).toBe("123.44");
      expect(
        new BigDecimal("123.456")
          .setScale(2, RoundingMode.HALF_EVEN)
          .toString(),
      ).toBe("123.46");
    });

    it("UNNECESSARY rounding should throw when rounding needed", () => {
      const a = new BigDecimal("123.456");
      expect(() => a.setScale(2, RoundingMode.UNNECESSARY)).toThrow(
        "Rounding necessary",
      );
    });

    it("UNNECESSARY rounding should not throw when exact", () => {
      const a = new BigDecimal("123.45");
      expect(a.setScale(2, RoundingMode.UNNECESSARY).toString()).toBe("123.45");
    });
  });

  describe("Comparison Methods", () => {
    it("compareTo", () => {
      const a = new BigDecimal("123.45");
      const b = new BigDecimal("67.89");
      const c = new BigDecimal("123.45");

      expect(a.compareTo(b)).toBe(1);
      expect(b.compareTo(a)).toBe(-1);
      expect(a.compareTo(c)).toBe(0);
    });

    it("equals", () => {
      const a = new BigDecimal("123.45");
      const b = new BigDecimal("123.45");
      const c = new BigDecimal("123.450");
      const d = new BigDecimal("123.46");

      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(true); // Should be equal despite different scales
      expect(a.equals(d)).toBe(false);
    });

    it("min", () => {
      const a = new BigDecimal("123.45");
      const b = new BigDecimal("67.89");

      expect(a.min(b)).toBe(b);
      expect(b.min(a)).toBe(b);
    });

    it("max", () => {
      const a = new BigDecimal("123.45");
      const b = new BigDecimal("67.89");

      expect(a.max(b)).toBe(a);
      expect(b.max(a)).toBe(a);
    });
  });

  describe("Utility Methods", () => {
    it("abs", () => {
      expect(new BigDecimal("123.45").abs().toString()).toBe("123.45");
      expect(new BigDecimal("-123.45").abs().toString()).toBe("123.45");
      expect(new BigDecimal("0").abs().toString()).toBe("0");
    });

    it("negate", () => {
      expect(new BigDecimal("123.45").negate().toString()).toBe("-123.45");
      expect(new BigDecimal("-123.45").negate().toString()).toBe("123.45");
      expect(new BigDecimal("0").negate().toString()).toBe("0");
    });

    it("pow", () => {
      expect(new BigDecimal("2").pow(3).toString()).toBe("8");
      expect(new BigDecimal("1.5").pow(2).toString()).toBe("2.25");
      expect(new BigDecimal("10").pow(0).toString()).toBe("1");
    });

    it("pow should throw on negative exponent", () => {
      expect(() => new BigDecimal("2").pow(-1)).toThrow(
        "Negative exponent not supported",
      );
    });

    it("signum", () => {
      expect(new BigDecimal("123.45").signum()).toBe(1);
      expect(new BigDecimal("-123.45").signum()).toBe(-1);
      expect(new BigDecimal("0").signum()).toBe(0);
    });

    it("remainder", () => {
      const a = new BigDecimal("10");
      const b = new BigDecimal("3");
      expect(a.remainder(b).toString()).toBe("1");

      const c = new BigDecimal("123.45");
      const d = new BigDecimal("10");
      expect(c.remainder(d).toString()).toBe("3.45");
    });
  });

  describe("Scale Operations", () => {
    it("setScale increasing scale", () => {
      const a = new BigDecimal("123.45");
      expect(a.setScale(3).toString()).toBe("123.450");
      expect(a.setScale(4).toString()).toBe("123.4500");
    });

    it("setScale decreasing scale", () => {
      const a = new BigDecimal("123.456");
      expect(a.setScale(2).toString()).toBe("123.46");
      expect(a.setScale(1).toString()).toBe("123.5");
      expect(a.setScale(0).toString()).toBe("123");
    });

    it("stripTrailingZeros", () => {
      expect(new BigDecimal("123.4500").stripTrailingZeros().toString()).toBe(
        "123.45",
      );
      expect(new BigDecimal("123.000").stripTrailingZeros().toString()).toBe(
        "123",
      );
      expect(new BigDecimal("0.0").stripTrailingZeros().toString()).toBe("0");
      expect(new BigDecimal("123").stripTrailingZeros().toString()).toBe("123");
    });

    it("getScale", () => {
      expect(new BigDecimal("123.45").scale()).toBe(2);
      expect(new BigDecimal("123").scale()).toBe(0);
      expect(new BigDecimal("0.001").scale()).toBe(3);
    });

    it("precision", () => {
      expect(new BigDecimal("123.45").precision()).toBe(5);
      expect(new BigDecimal("0.001").precision()).toBe(1);
      expect(new BigDecimal("0").precision()).toBe(1);
      expect(new BigDecimal("-123.45").precision()).toBe(5);
    });

    it("unscaledValue", () => {
      expect(new BigDecimal("123.45").unscaledValue()).toBe(12345n);
      expect(new BigDecimal("-123.45").unscaledValue()).toBe(-12345n);
      expect(new BigDecimal("123").unscaledValue()).toBe(123n);
    });
  });

  describe("Conversion Methods", () => {
    it("toString", () => {
      expect(new BigDecimal("123.45").toString()).toBe("123.45");
      expect(new BigDecimal("-123.45").toString()).toBe("-123.45");
      expect(new BigDecimal("0.001").toString()).toBe("0.001");
      expect(new BigDecimal("123").toString()).toBe("123");
    });

    it("toNumber", () => {
      expect(new BigDecimal("123.45").toNumber()).toBe(123.45);
      expect(new BigDecimal("-123.45").toNumber()).toBe(-123.45);
      expect(new BigDecimal("0").toNumber()).toBe(0);
    });

    it("toBigInt", () => {
      expect(new BigDecimal("123").toBigInt()).toBe(123n);
      expect(new BigDecimal("123.45").toBigInt()).toBe(123n);
      expect(new BigDecimal("123.99").toBigInt()).toBe(123n);
      expect(new BigDecimal("-123.45").toBigInt()).toBe(-123n);
    });

    it("toFixed", () => {
      const a = new BigDecimal("123.456789");
      expect(a.toFixed(2)).toBe("123.46");
      expect(a.toFixed(4)).toBe("123.4568");
      expect(a.toFixed(0)).toBe("123");
    });
  });

  describe("Static Methods", () => {
    it("valueOf", () => {
      expect(BigDecimal.valueOf("123.45").toString()).toBe("123.45");
      expect(BigDecimal.valueOf(123.45).toString()).toBe("123.45");
      expect(BigDecimal.valueOf(123n).toString()).toBe("123");
    });
  });

  describe("Edge Cases", () => {
    it("very large numbers", () => {
      const a = new BigDecimal("999999999999999999999999999999.99");
      const b = new BigDecimal("1.01");
      expect(a.add(b).stripTrailingZeros().toString()).toBe("1000000000000000000000000000001");
    });

    it("very small decimals", () => {
      const a = new BigDecimal("0.000000000000000001");
      const b = new BigDecimal("0.000000000000000002");
      expect(a.add(b).toString()).toBe("0.000000000000000003");
    });

    it("operations with zero", () => {
      const zero = new BigDecimal("0");
      const num = new BigDecimal("123.45");

      expect(num.add(zero).toString()).toBe("123.45");
      expect(num.subtract(zero).toString()).toBe("123.45");
      expect(num.multiply(zero).toString()).toBe("0");
    });

    it("chained operations", () => {
      const result = new BigDecimal("100")
        .add(new BigDecimal("50"))
        .multiply(new BigDecimal("2"))
        .subtract(new BigDecimal("100"))
        .divide(new BigDecimal("4"), 2);

      expect(result.stripTrailingZeros().toString()).toBe("50");
    });
  });

  describe("Additional Edge Cases", () => {
    it("should handle leading zeros in string constructor", () => {
      expect(new BigDecimal("0123.45").toString()).toBe("123.45");
      expect(new BigDecimal("000.123").toString()).toBe("0.123");
      expect(new BigDecimal("-0123.45").toString()).toBe("-123.45");
    });

    it("should handle very long decimal strings", () => {
      const longDecimal = "123.123456789012345678901234567890";
      const bd = new BigDecimal(longDecimal);
      expect(bd.toString()).toBe(longDecimal);
    });

    it("should handle constructor with zero scale", () => {
      const bd = new BigDecimal(12345n, 0);
      expect(bd.toString()).toBe("12345");
      expect(bd.scale()).toBe(0);
    });

    it("should handle constructor with large scale", () => {
      const bd = new BigDecimal(12345n, 10);
      expect(bd.toString()).toBe("0.0000012345");
      expect(bd.scale()).toBe(10);
    });

    it("should handle string with only decimal point", () => {
      expect(() => new BigDecimal(".")).toThrow("Invalid number format");
    });

    it("should handle empty string", () => {
      expect(() => new BigDecimal("")).toThrow();
    });

    it("should handle scientific notation from number", () => {
      const bd = new BigDecimal(1.23e-5);
      expect(bd.toNumber()).toBe(1.23e-5);
    });

    it("should handle very large bigint constructor", () => {
      const largeBigint = 123456789012345678901234567890n;
      const bd = new BigDecimal(largeBigint);
      expect(bd.toString()).toBe("123456789012345678901234567890");
    });

    it("should handle negative zero", () => {
      const bd = new BigDecimal("-0");
      expect(bd.toString()).toBe("0");
      expect(bd.signum()).toBe(0);
    });

    it("should handle negative zero with decimals", () => {
      const bd = new BigDecimal("-0.000");
      expect(bd.toString()).toBe("0.000");
      expect(bd.stripTrailingZeros().toString()).toBe("0");
      expect(bd.signum()).toBe(0);
    });
  });

  describe("Advanced Arithmetic Operations", () => {
    it("should handle addition with very different scales", () => {
      const a = new BigDecimal("123");
      const b = new BigDecimal("0.000000001");
      expect(a.add(b).toString()).toBe("123.000000001");
    });

    it("should handle subtraction resulting in zero", () => {
      const a = new BigDecimal("123.45");
      const b = new BigDecimal("123.45");
      const result = a.subtract(b);
      expect(result.toString()).toBe("0.00");
      expect(result.signum()).toBe(0);
    });

    it("should handle multiplication with one", () => {
      const a = new BigDecimal("123.45");
      const result = a.multiply(BigDecimal.ONE);
      expect(result.toString()).toBe("123.45");
    });

    it("should handle multiplication with ten", () => {
      const a = new BigDecimal("123.45");
      const result = a.multiply(BigDecimal.TEN);
      expect(result.toString()).toBe("1234.50");
    });

    it("should handle division by one", () => {
      const a = new BigDecimal("123.45");
      const result = a.divide(BigDecimal.ONE);
      expect(result.toString()).toBe("123.45");
    });

    it("should handle division by ten", () => {
      const a = new BigDecimal("123.45");
      const result = a.divide(BigDecimal.TEN, 3);
      expect(result.toString()).toBe("12.345");
    });

    it("should handle division with infinite precision requirement", () => {
      const a = new BigDecimal("1");
      const b = new BigDecimal("3");
      const result = a.divide(b, 10);
      expect(result.toString()).toBe("0.3333333333");
    });

    it("should handle repeated subtraction", () => {
      let result = new BigDecimal("100");
      for (let i = 0; i < 10; i++) {
        result = result.subtract(new BigDecimal("10"));
      }
      expect(result.toString()).toBe("0");
    });

    it("should handle repeated division", () => {
      let result = new BigDecimal("1024");
      for (let i = 0; i < 10; i++) {
        result = result.divide(new BigDecimal("2"));
      }
      expect(result.toString()).toBe("1");
    });
  });

  describe("Advanced Comparison Tests", () => {
    it("should compare numbers with different scales correctly", () => {
      const a = new BigDecimal("123.4");
      const b = new BigDecimal("123.40");
      const c = new BigDecimal("123.400");

      expect(a.equals(b)).toBe(true);
      expect(b.equals(c)).toBe(true);
      expect(a.equals(c)).toBe(true);
      expect(a.compareTo(b)).toBe(0);
      expect(b.compareTo(c)).toBe(0);
    });

    it("should handle comparison with zero", () => {
      const positive = new BigDecimal("0.001");
      const negative = new BigDecimal("-0.001");
      const zero = BigDecimal.ZERO;

      expect(positive.compareTo(zero)).toBe(1);
      expect(negative.compareTo(zero)).toBe(-1);
      expect(zero.compareTo(zero)).toBe(0);
    });

    it("should handle min/max with equal values", () => {
      const a = new BigDecimal("123.45");
      const b = new BigDecimal("123.450");

      expect(a.min(b)).toBe(a); // Should return first operand when equal
      expect(a.max(b)).toBe(a); // Should return first operand when equal
    });

    it("should handle min/max with negative numbers", () => {
      const a = new BigDecimal("-123.45");
      const b = new BigDecimal("-67.89");

      expect(a.min(b)).toBe(a); // -123.45 is smaller
      expect(a.max(b)).toBe(b); // -67.89 is larger
    });
  });

  describe("Advanced Rounding Tests", () => {
    it("should handle rounding with negative numbers", () => {
      const a = new BigDecimal("-123.456");

      expect(a.setScale(2, RoundingMode.HALF_UP).toString()).toBe("-123.46");
      expect(a.setScale(2, RoundingMode.HALF_DOWN).toString()).toBe("-123.46");
      expect(a.setScale(2, RoundingMode.UP).toString()).toBe("-123.46");
      expect(a.setScale(2, RoundingMode.DOWN).toString()).toBe("-123.45");
    });

    it("should handle rounding exactly on boundary", () => {
      const a = new BigDecimal("123.5");

      expect(a.setScale(0, RoundingMode.HALF_UP).toString()).toBe("124");
      expect(a.setScale(0, RoundingMode.HALF_DOWN).toString()).toBe("123");
      expect(a.setScale(0, RoundingMode.HALF_EVEN).toString()).toBe("124");
    });

    it("should handle rounding with zero", () => {
      const a = new BigDecimal("0.000");

      expect(a.setScale(1, RoundingMode.HALF_UP).toString()).toBe("0.0");
      expect(a.setScale(0, RoundingMode.HALF_UP).toString()).toBe("0");
    });

    it("should handle setScale with same scale", () => {
      const a = new BigDecimal("123.45");
      const result = a.setScale(2);

      expect(result.toString()).toBe("123.45");
      expect(result).not.toBe(a); // Should return new instance
    });
  });

  describe("Power and Advanced Utility Tests", () => {
    it("should handle pow with zero exponent", () => {
      const a = new BigDecimal("0");
      expect(a.pow(0).toString()).toBe("1");
    });

    it("should handle pow with decimal base", () => {
      const a = new BigDecimal("0.5");
      expect(a.pow(3).toString()).toBe("0.125");
    });

    it("should handle pow with negative base", () => {
      const a = new BigDecimal("-2");
      expect(a.pow(3).toString()).toBe("-8");
      expect(a.pow(2).toString()).toBe("4");
    });

    it("should handle large exponents", () => {
      const a = new BigDecimal("2");
      expect(a.pow(10).toString()).toBe("1024");
    });

    it("should handle remainder with decimals", () => {
      const a = new BigDecimal("7.5");
      const b = new BigDecimal("2.3");
      const result = a.remainder(b);

      // 7.5 % 2.3 should be approximately 0.6
      expect(result.toString()).toBe("0.6");
    });

    it("should handle remainder with negative dividend", () => {
      const a = new BigDecimal("-10");
      const b = new BigDecimal("3");
      const result = a.remainder(b);

      // -10 % 3 should be -1
      expect(result.toString()).toBe("-1");
    });

    it("should handle remainder with negative divisor", () => {
      const a = new BigDecimal("10");
      const b = new BigDecimal("-3");
      const result = a.remainder(b);

      // 10 % -3 should be 1
      expect(result.toString()).toBe("1");
    });
  });

  describe("Precision and Scale Edge Cases", () => {
    it("should calculate precision correctly for zero", () => {
      expect(new BigDecimal("0").precision()).toBe(1);
      expect(new BigDecimal("0.0").precision()).toBe(1);
      expect(new BigDecimal("0.00").precision()).toBe(1);
    });

    it("should calculate precision for numbers with leading zeros", () => {
      expect(new BigDecimal("0.001").precision()).toBe(1);
      expect(new BigDecimal("0.0123").precision()).toBe(3);
    });

    it("should handle stripTrailingZeros with integers", () => {
      const a = new BigDecimal("123");
      expect(a.stripTrailingZeros().toString()).toBe("123");
    });

    it("should handle stripTrailingZeros with mixed trailing zeros", () => {
      expect(new BigDecimal("123.1000").stripTrailingZeros().toString()).toBe("123.1");
      expect(new BigDecimal("123.0100").stripTrailingZeros().toString()).toBe("123.01");
    });

    it("should handle unscaledValue with negative numbers", () => {
      const a = new BigDecimal("-123.45");
      expect(a.unscaledValue()).toBe(-12345n);
    });
  });

  describe("Static Method Tests", () => {
    it("should handle valueOf with different types", () => {
      expect(BigDecimal.valueOf("0").toString()).toBe("0");
      expect(BigDecimal.valueOf(0).toString()).toBe("0");
      expect(BigDecimal.valueOf(0n).toString()).toBe("0");
    });

    it("should ensure static constants are immutable", () => {
      const zero1 = BigDecimal.ZERO;
      const zero2 = BigDecimal.ZERO;
      expect(zero1).toBe(zero2); // Should be same reference

      const one1 = BigDecimal.ONE;
      const one2 = BigDecimal.ONE;
      expect(one1).toBe(one2); // Should be same reference
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle financial calculations", () => {
      // Simulate compound interest: P(1 + r)^n
      const principal = new BigDecimal("1000.00");
      const rate = new BigDecimal("1.05"); // 5% interest
      const years = 3;

      let result = principal;
      for (let i = 0; i < years; i++) {
        result = result.multiply(rate);
      }

      expect(result.setScale(2).toString()).toBe("1157.63");
    });

    it("should handle currency calculations with proper rounding", () => {
      const price = new BigDecimal("19.99");
      const taxRate = new BigDecimal("0.08"); // 8% tax
      const tax = price.multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
      const total = price.add(tax);

      expect(tax.toString()).toBe("1.60");
      expect(total.toString()).toBe("21.59");
    });

    it("should handle averaging with proper scale", () => {
      const values = [
        new BigDecimal("10.33"),
        new BigDecimal("15.67"),
        new BigDecimal("12.50")
      ];

      let sum = BigDecimal.ZERO;
      for (const value of values) {
        sum = sum.add(value);
      }

      const average = sum.divide(new BigDecimal("3"), 2);
      expect(average.toString()).toBe("12.83");
    });

    it("should handle percentage calculations", () => {
      const total = new BigDecimal("1250.00");
      const percentage = new BigDecimal("0.15"); // 15%
      const result = total.multiply(percentage);

      expect(result.toString()).toBe("187.5000");
      expect(result.stripTrailingZeros().toString()).toBe("187.5");
    });
  });

  describe("Error Handling and Boundary Conditions", () => {
    it("should handle invalid string formats", () => {
      expect(() => new BigDecimal("123.45.67.89")).toThrow("Invalid number format");
      expect(() => new BigDecimal("abc")).toThrow();
      expect(() => new BigDecimal("12.34abc")).toThrow();
    });

    it("should handle division rounding modes with exact results", () => {
      const a = new BigDecimal("10");
      const b = new BigDecimal("2");

      // Should not throw even with UNNECESSARY mode since result is exact
      expect(a.divide(b, 1, RoundingMode.UNNECESSARY).toString()).toBe("5.0");
    });

    it("should handle very large scale operations", () => {
      const a = new BigDecimal("1");
      const result = a.setScale(50);

      expect(result.scale()).toBe(50);
      expect(result.toString().endsWith("." + "0".repeat(50))).toBe(true);
    });

    it("should handle scale reduction to negative (should throw or handle gracefully)", () => {
      const a = new BigDecimal("123.45");
      // Depending on implementation, this might throw or handle gracefully
      // Testing current behavior
      expect(() => a.setScale(-1)).not.toThrow();
    });
  });
});
