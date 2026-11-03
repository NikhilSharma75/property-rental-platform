import { describe, it, expect } from "vitest";
import { formatMoney, initials, relativeTime } from "../src/lib/format";

describe("formatMoney", () => {
  it("formats whole amounts with a currency symbol and no decimals", () => {
    expect(formatMoney(25000, { currency: "USD" })).toContain("25,000");
    expect(formatMoney(25000, { currency: "USD" })).not.toContain(".");
  });
  it("supports decimals", () => expect(formatMoney(10.5, { currency: "USD", decimals: true })).toContain("10.50"));
  it("handles empty and invalid values", () => {
    expect(formatMoney(null)).toMatch(/0/);
    expect(formatMoney("abc")).toBe("—");
  });
});

describe("initials", () => {
  it("returns up to two capital letters", () => expect(initials("jane mary doe")).toBe("JM"));
  it("copes with missing names", () => expect(initials(null)).toBe("?"));
});

describe("relativeTime", () => {
  it("describes recent times", () => {
    expect(relativeTime(new Date().toISOString())).toBe("just now");
    expect(relativeTime(new Date(Date.now() - 5 * 60_000).toISOString())).toBe("5m ago");
    expect(relativeTime(new Date(Date.now() - 3 * 3_600_000).toISOString())).toBe("3h ago");
  });
});
