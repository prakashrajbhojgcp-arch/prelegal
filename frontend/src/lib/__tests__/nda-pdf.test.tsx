import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { PDFParse } from "pdf-parse";
import { loadStandardTermsBlocks } from "@/lib/templates";
import { defaultNdaData, type NdaData } from "@/lib/nda-schema";
import { NdaPdfDocument } from "@/lib/nda-pdf-document";

const blocks = loadStandardTermsBlocks();

const renderPdfText = async (data: NdaData): Promise<string> => {
  const buffer = await renderToBuffer(
    <NdaPdfDocument data={data} standardTermsBlocks={blocks} />,
  );
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    // react-pdf paginates by inserting soft hyphens and line breaks inside
    // long paragraphs. Collapse them so tests can assert on the logical text
    // without fighting wrap points.
    return result.text
      .replace(/-\s*\n\s*/g, "")
      .replace(/\s+/g, " ");
  } finally {
    await parser.destroy();
  }
};

const fullyPopulated = (): NdaData => ({
  ...defaultNdaData(),
  purpose: "Evaluating a potential cloud partnership.",
  effectiveDate: "2026-02-14",
  governingLaw: "Delaware",
  jurisdiction: "New Castle County, Delaware",
  modifications: "Section 5 — extend MNDA Term by one renewal year.",
  party1: {
    name: "Alex Rivera",
    title: "General Counsel",
    company: "Acme Robotics Inc.",
    noticeAddress: "100 Main St, Wilmington, DE 19801",
    date: "2026-02-14",
  },
  party2: {
    name: "Priya Patel",
    title: "Head of Legal",
    company: "Zenith AI Labs",
    noticeAddress: "legal@zenith.example",
    date: "2026-02-14",
  },
});

describe("NdaPdfDocument", () => {
  it("renders a non-empty PDF buffer starting with the %PDF header", async () => {
    const buffer = await renderToBuffer(
      <NdaPdfDocument
        data={defaultNdaData()}
        standardTermsBlocks={blocks}
      />,
    );
    expect(buffer.byteLength).toBeGreaterThan(2000);
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });

  it("includes the document title and the cover-page field labels", async () => {
    const text = await renderPdfText(defaultNdaData());
    expect(text).toContain("Mutual Non-Disclosure Agreement");
    expect(text).toContain("PURPOSE");
    expect(text).toContain("EFFECTIVE DATE");
    expect(text).toContain("MNDA TERM");
    expect(text).toContain("TERM OF CONFIDENTIALITY");
    expect(text).toContain("GOVERNING LAW & JURISDICTION");
  });

  it("includes the standard-terms heading and every numbered section", async () => {
    const text = await renderPdfText(defaultNdaData());
    expect(text).toContain("Standard Terms");
    for (const section of [
      "Introduction",
      "Use and Protection of Confidential Information",
      "Exceptions",
      "Disclosures Required by Law",
      "Term and Termination",
      "Return or Destruction of Confidential Information",
      "Proprietary Rights",
      "Disclaimer",
      "Governing Law and Jurisdiction",
      "Equitable Relief",
      "General",
    ]) {
      expect(text).toContain(section);
    }
  });

  it("renders user-entered values in the cover fields", async () => {
    const data = fullyPopulated();
    const text = await renderPdfText(data);
    expect(text).toContain("Evaluating a potential cloud partnership.");
    expect(text).toContain("February 14, 2026");
    expect(text).toContain("Delaware");
    expect(text).toContain("New Castle County, Delaware");
    expect(text).toContain(
      "Section 5 — extend MNDA Term by one renewal year.",
    );
  });

  it("renders both parties' company, name, title, and notice address", async () => {
    const data = fullyPopulated();
    const text = await renderPdfText(data);
    for (const v of [
      "Acme Robotics Inc.",
      "Alex Rivera",
      "General Counsel",
      "100 Main St, Wilmington, DE 19801",
      "Zenith AI Labs",
      "Priya Patel",
      "Head of Legal",
      "legal@zenith.example",
    ]) {
      expect(text).toContain(v);
    }
  });

  it("renders the years-form MNDA term phrase by default", async () => {
    const text = await renderPdfText(defaultNdaData());
    expect(text).toContain("Expires 1 year from the Effective Date.");
  });

  it("renders the untilTerminated phrase when chosen", async () => {
    const data: NdaData = {
      ...defaultNdaData(),
      mndaTerm: { kind: "untilTerminated" },
    };
    const text = await renderPdfText(data);
    expect(text).toContain(
      "Continues until terminated in accordance with the terms of the MNDA.",
    );
  });

  it("renders the perpetuity phrase when confidentiality term is set to perpetuity", async () => {
    const data: NdaData = {
      ...defaultNdaData(),
      confidentialityTerm: { kind: "perpetuity" },
    };
    const text = await renderPdfText(data);
    expect(text).toContain("In perpetuity.");
  });

  it("shows the empty-modifications fallback when none are provided", async () => {
    const data = defaultNdaData();
    data.modifications = "";
    const text = await renderPdfText(data);
    expect(text).toContain("None.");
  });

  it("preserves curly quotes that appear in the standard terms", async () => {
    const text = await renderPdfText(defaultNdaData());
    expect(text).toContain("“MNDA”");
    expect(text).toContain("“Confidential Information”");
  });
});
