import { describe, expect, it } from "vitest";
import fixture from "./nda-schema-parity.fixture.json";
import type { NdaData } from "@/lib/nda-schema";

describe("NdaData ↔ fixture parity", () => {
  it("the fixture is assignable to NdaData", () => {
    // Compile-time check; if this stops compiling, the TS shape drifted.
    const data: NdaData = fixture as NdaData;
    expect(data.governingLaw).toBe("Delaware");
    expect(data.party1.noticeAddress).toBe("1 Main St");
    expect(data.mndaTerm.kind).toBe("years");
    expect(data.confidentialityTerm.kind).toBe("perpetuity");
  });
});
