import { describe, expect, it } from "vitest";
import { formatDate, pluralYears, todayIso } from "@/lib/format";

describe("formatDate", () => {
  it("renders an ISO date in US long form", () => {
    expect(formatDate("2026-01-09")).toBe("January 9, 2026");
  });

  it("handles December", () => {
    expect(formatDate("2025-12-31")).toBe("December 31, 2025");
  });

  it("returns empty string for empty input", () => {
    expect(formatDate("")).toBe("");
  });

  it("returns the raw value when the input is not a parseable ISO date", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });

  it("returns the raw value when only two segments are present", () => {
    expect(formatDate("2026-01")).toBe("2026-01");
  });
});

describe("pluralYears", () => {
  it("uses singular for 1", () => {
    expect(pluralYears(1)).toBe("1 year");
  });

  it("uses plural for 0", () => {
    expect(pluralYears(0)).toBe("0 years");
  });

  it("uses plural for 5", () => {
    expect(pluralYears(5)).toBe("5 years");
  });
});

describe("todayIso", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("agrees with the current local date", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(todayIso()).toBe(expected);
  });
});
