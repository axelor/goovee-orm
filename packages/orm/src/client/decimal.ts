export enum RoundingMode {
  UP = "UP",
  DOWN = "DOWN",
  CEILING = "CEILING",
  FLOOR = "FLOOR",
  HALF_UP = "HALF_UP",
  HALF_DOWN = "HALF_DOWN",
  HALF_EVEN = "HALF_EVEN",
  UNNECESSARY = "UNNECESSARY",
}

export class BigDecimal {
  #value: bigint;
  #scale: number;

  static readonly ZERO = new BigDecimal("0");
  static readonly ONE = new BigDecimal("1");
  static readonly TEN = new BigDecimal("10");

  constructor(value: string);
  constructor(value: number);
  constructor(value: bigint);
  constructor(unscaledValue: bigint, scale: number);
  constructor(value: string | number | bigint, scale?: number) {
    if (typeof value === "bigint" && scale !== undefined) {
      // Constructor with unscaled value and scale
      this.#value = value;
      this.#scale = scale;
      return;
    }

    if (typeof value === "string") {
      const parts = value.split(".");

      if (parts.length > 2 || value.trim() === "" || value.trim() === ".") {
        throw new Error("Invalid number format");
      }

      const integerPart = parts[0].replace(/^-/, "");
      const decimalPart = parts[1] || "";
      const isNegative = value.startsWith("-");

      this.#scale = decimalPart.length;
      const combined = integerPart + decimalPart;
      this.#value = BigInt(isNegative ? "-" + combined : combined);
    } else if (typeof value === "number") {
      const strValue = String(value);
      const parts = strValue.split(".");

      if (parts.length > 2) {
        throw new Error("Invalid number format");
      }

      const integerPart = parts[0].replace(/^-/, "");
      const decimalPart = parts[1] || "";
      const isNegative = strValue.startsWith("-");

      this.#scale = decimalPart.length;
      const combined = integerPart + decimalPart;
      this.#value = BigInt(isNegative ? "-" + combined : combined);
    } else if (typeof value === "bigint") {
      this.#value = value;
      this.#scale = 0;
    } else {
      throw new Error("Invalid constructor arguments");
    }
  }

  add(other: BigDecimal): BigDecimal {
    const maxScale = Math.max(this.#scale, other.#scale);
    const thisScaled = this.#scaleByPowerOfTen(maxScale - this.#scale);
    const otherScaled = other.#scaleByPowerOfTen(maxScale - other.#scale);

    const result = new BigDecimal("0");
    result.#value = thisScaled.#value + otherScaled.#value;
    result.#scale = maxScale;
    return result;
  }

  subtract(other: BigDecimal): BigDecimal {
    const maxScale = Math.max(this.#scale, other.#scale);
    const thisScaled = this.#scaleByPowerOfTen(maxScale - this.#scale);
    const otherScaled = other.#scaleByPowerOfTen(maxScale - other.#scale);

    const result = new BigDecimal("0");
    result.#value = thisScaled.#value - otherScaled.#value;
    result.#scale = maxScale;
    return result;
  }

  multiply(other: BigDecimal): BigDecimal {
    const result = new BigDecimal("0");
    result.#value = this.#value * other.#value;
    result.#scale = this.#scale + other.#scale;

    // Normalize zero to have scale 0
    if (result.#value === 0n) {
      result.#scale = 0;
    }

    return result;
  }

  divide(
    divisor: BigDecimal,
    scale?: number,
    roundingMode: RoundingMode = RoundingMode.HALF_UP,
  ): BigDecimal {
    if (divisor.compareTo(BigDecimal.ZERO) === 0) {
      throw new Error("Division by zero");
    }

    const targetScale =
      scale !== undefined ? scale : Math.max(this.#scale, divisor.#scale);

    // Scale up dividend to maintain precision
    const scaleDiff = targetScale + divisor.#scale - this.#scale;
    const scaledDividend = this.#scaleByPowerOfTen(scaleDiff);

    let quotient = scaledDividend.#value / divisor.#value;
    const remainder = scaledDividend.#value % divisor.#value;

    // Apply rounding
    if (remainder !== 0n) {
      quotient = this.#applyRounding(
        quotient,
        remainder,
        divisor.#value,
        roundingMode,
      );
    }

    const result = new BigDecimal("0");
    result.#value = quotient;
    result.#scale = targetScale;
    return result;
  }

  compareTo(other: BigDecimal): number {
    const maxScale = Math.max(this.#scale, other.#scale);
    const thisScaled = this.#scaleByPowerOfTen(maxScale - this.#scale);
    const otherScaled = other.#scaleByPowerOfTen(maxScale - other.#scale);

    if (thisScaled.#value < otherScaled.#value) return -1;
    if (thisScaled.#value > otherScaled.#value) return 1;
    return 0;
  }

  equals(other: BigDecimal): boolean {
    return this.compareTo(other) === 0;
  }

  abs(): BigDecimal {
    const result = new BigDecimal("0");
    result.#value = this.#value < 0n ? -this.#value : this.#value;
    result.#scale = this.#scale;
    return result;
  }

  negate(): BigDecimal {
    const result = new BigDecimal("0");
    result.#value = -this.#value;
    result.#scale = this.#scale;
    return result;
  }

  pow(n: number): BigDecimal {
    if (n < 0) {
      throw new Error("Negative exponent not supported");
    }

    const result = new BigDecimal("0");
    result.#value = this.#value ** BigInt(n);
    result.#scale = this.#scale * n;
    return result;
  }

  setScale(
    newScale: number,
    roundingMode: RoundingMode = RoundingMode.HALF_UP,
  ): BigDecimal {
    if (newScale === this.#scale) {
      return new BigDecimal(this.#value, this.#scale);
    }

    if (newScale > this.#scale) {
      // Increasing scale - just multiply by power of 10
      const result = new BigDecimal("0");
      result.#value = this.#value * 10n ** BigInt(newScale - this.#scale);
      result.#scale = newScale;
      return result;
    }

    // Need to round
    const scaleDiff = this.#scale - newScale;
    const divisor = 10n ** BigInt(scaleDiff);

    let newValue = this.#value / divisor;
    const remainder = this.#value % divisor;

    if (remainder !== 0n) {
      newValue = this.#applyRounding(
        newValue,
        remainder,
        divisor,
        roundingMode,
      );
    }

    const result = new BigDecimal("0");
    result.#value = newValue;
    result.#scale = newScale;
    return result;
  }

  stripTrailingZeros(): BigDecimal {
    let strValue = this.toString();
    if (!strValue.includes(".")) {
      return new BigDecimal(this.#value, this.#scale);
    }

    strValue = strValue.replace(/\.?0+$/, "");
    return new BigDecimal(strValue);
  }

  toString(): string {
    if (this.#scale === 0) {
      return this.#value.toString();
    }

    const absValue = this.#value < 0n ? -this.#value : this.#value;
    const strValue = absValue.toString().padStart(this.#scale + 1, "0");

    const integerPart = strValue.slice(0, -this.#scale) || "0";
    const decimalPart = strValue.slice(-this.#scale);

    const result = integerPart + "." + decimalPart;
    return this.#value < 0n ? "-" + result : result;
  }

  toNumber(): number {
    return Number(this.toString());
  }

  toBigInt(): bigint {
    if (this.#scale === 0) {
      return this.#value;
    }
    return this.#value / 10n ** BigInt(this.#scale);
  }

  toFixed(digits: number): string {
    return this.setScale(digits, RoundingMode.HALF_UP).toString();
  }

  toJSON() {
    return this.toString();
  }

  // Private helper methods
  #scaleByPowerOfTen(n: number): BigDecimal {
    if (n === 0) {
      return new BigDecimal(this.#value, this.#scale);
    }

    const result = new BigDecimal("0");
    result.#value = this.#value * 10n ** BigInt(Math.abs(n));
    result.#scale = this.#scale;
    return result;
  }

  #applyRounding(
    quotient: bigint,
    remainder: bigint,
    divisor: bigint,
    mode: RoundingMode,
  ): bigint {
    const absRemainder = remainder < 0n ? -remainder : remainder;
    const absDivisor = divisor < 0n ? -divisor : divisor;
    const isNegative = remainder < 0n !== divisor < 0n;

    switch (mode) {
      case RoundingMode.UP:
        return absRemainder > 0n
          ? quotient + (isNegative ? -1n : 1n)
          : quotient;

      case RoundingMode.DOWN:
        return quotient;

      case RoundingMode.CEILING:
        return absRemainder > 0n && !isNegative ? quotient + 1n : quotient;

      case RoundingMode.FLOOR:
        return absRemainder > 0n && isNegative ? quotient - 1n : quotient;

      case RoundingMode.HALF_UP:
        return absRemainder * 2n >= absDivisor
          ? quotient + (isNegative ? -1n : 1n)
          : quotient;

      case RoundingMode.HALF_DOWN:
        return absRemainder * 2n > absDivisor
          ? quotient + (isNegative ? -1n : 1n)
          : quotient;

      case RoundingMode.HALF_EVEN:
        if (absRemainder * 2n > absDivisor) {
          return quotient + (isNegative ? -1n : 1n);
        } else if (absRemainder * 2n === absDivisor) {
          // Round to even
          return quotient % 2n !== 0n
            ? quotient + (isNegative ? -1n : 1n)
            : quotient;
        }
        return quotient;

      case RoundingMode.UNNECESSARY:
        throw new Error("Rounding necessary");

      default:
        throw new Error("Unknown rounding mode");
    }
  }

  static valueOf(value: string): BigDecimal;
  static valueOf(value: number): BigDecimal;
  static valueOf(value: bigint): BigDecimal;
  static valueOf(value: string | number | bigint): BigDecimal {
    return new BigDecimal(value as unknown as bigint);
  }

  min(other: BigDecimal): BigDecimal {
    return this.compareTo(other) <= 0 ? this : other;
  }

  max(other: BigDecimal): BigDecimal {
    return this.compareTo(other) >= 0 ? this : other;
  }

  signum(): number {
    if (this.#value === 0n) return 0;
    return this.#value > 0n ? 1 : -1;
  }

  remainder(divisor: BigDecimal): BigDecimal {
    // For remainder, we need to use truncation towards zero
    const maxScale = Math.max(this.#scale, divisor.#scale);
    const thisScaled =
      this.#scale === maxScale ? this : this.setScale(maxScale);
    const divisorScaled =
      divisor.#scale === maxScale ? divisor : divisor.setScale(maxScale);

    const quotient = thisScaled.#value / divisorScaled.#value;
    const remainder = thisScaled.#value % divisorScaled.#value;

    const result = new BigDecimal("0");
    result.#value = remainder;
    result.#scale = maxScale;
    return result;
  }

  scale(): number {
    return this.#scale;
  }

  precision(): number {
    if (this.#value === 0n) return 1;
    const absValue = this.#value < 0n ? -this.#value : this.#value;
    return absValue.toString().length;
  }

  unscaledValue(): bigint {
    return this.#value;
  }
}
