import { buildGenericSpec } from "../generic/spec-builder";

export const spec = buildGenericSpec({
  slug: "mutual-nda-coverpage",
  name: "Mutual NDA — Cover Page",
  description:
    "Cover Page for the Common Paper Mutual NDA. Capture counterparty details and signatures; incorporates the MNDA Standard Terms by reference.",
  filename: "Mutual-NDA-coverpage.md",
  pageSubtitle:
    "Tell the assistant the cover-page details — the preview fills in as you chat.",
  pdfFilenamePrefix: "Mutual-NDA-Cover-Page",
  greeting:
    "Hi — I'll help you draft a stand-alone Cover Page for the Common Paper Mutual NDA. What are the two company names?",
  numParties: 2,
  manifest: [
    {
      key: "purpose",
      label: "Purpose",
      description: "Why the parties are exchanging confidential information.",
    },
    {
      key: "effectiveDate",
      label: "Effective Date",
      description: "ISO yyyy-mm-dd.",
    },
    {
      key: "mndaTerm",
      label: "MNDA Term",
      description:
        "How long the MNDA itself stays in force (e.g. '1 year', 'until terminated').",
    },
    {
      key: "confidentialityTerm",
      label: "Term of Confidentiality",
      description:
        "How long confidentiality obligations last (e.g. '2 years', 'in perpetuity').",
    },
    {
      key: "governingLaw",
      label: "Governing Law",
      description: "US state whose law governs.",
    },
    {
      key: "jurisdiction",
      label: "Jurisdiction",
      description: "City/county and state for dispute venue.",
    },
    {
      key: "modifications",
      label: "MNDA Modifications",
      description: "Any tweaks to the standard MNDA terms. Empty means none.",
    },
  ],
});
