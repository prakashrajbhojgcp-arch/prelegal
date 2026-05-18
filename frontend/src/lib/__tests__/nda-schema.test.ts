import { describe, expect, it } from "vitest";
import {
  DEFAULT_PURPOSE,
  defaultNdaData,
  emptyParty,
} from "@/lib/nda-schema";

describe("defaultNdaData", () => {
  it("returns a fresh object each call", () => {
    const a = defaultNdaData();
    const b = defaultNdaData();
    expect(a).not.toBe(b);
    expect(a.party1).not.toBe(b.party1);
  });

  it("seeds the canonical purpose", () => {
    expect(defaultNdaData().purpose).toBe(DEFAULT_PURPOSE);
  });

  it("defaults both terms to one year", () => {
    const d = defaultNdaData();
    expect(d.mndaTerm).toEqual({ kind: "years", years: 1 });
    expect(d.confidentialityTerm).toEqual({ kind: "years", years: 1 });
  });

  it("leaves governing law and jurisdiction empty for the user to fill in", () => {
    const d = defaultNdaData();
    expect(d.governingLaw).toBe("");
    expect(d.jurisdiction).toBe("");
  });

  it("seeds effectiveDate and party dates to today (YYYY-MM-DD)", () => {
    const d = defaultNdaData();
    expect(d.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(d.party1.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(d.party2.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("emptyParty", () => {
  it("has all the required fields blank except date", () => {
    const p = emptyParty();
    expect(p.name).toBe("");
    expect(p.title).toBe("");
    expect(p.company).toBe("");
    expect(p.noticeAddress).toBe("");
    expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
