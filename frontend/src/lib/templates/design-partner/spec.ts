import { buildGenericSpec } from "../generic/spec-builder";

export const spec = buildGenericSpec({
  slug: "design-partner-agreement",
  name: "Design Partner Agreement",
  description:
    "Common Paper standard Design Partner Agreement for early-stage collaboration between a vendor and a design partner customer.",
  filename: "Design-Partner-Agreement.md",
  pageSubtitle:
    "Tell the assistant about your design-partner program — the preview fills in as you chat.",
  pdfFilenamePrefix: "Design-Partner-Agreement",
  greeting:
    "Hi — I'll help you draft a Common Paper Design Partner Agreement. Party 1 is the Provider (vendor) and Party 2 is the Design Partner (customer). What are the two company names?",
  numParties: 2,
  manifest: [
    {
      key: "effectiveDate",
      label: "Effective Date",
      description: "ISO yyyy-mm-dd.",
    },
    {
      key: "programScope",
      label: "Program Scope",
      description:
        "What Provider gives Design Partner (early access, custom builds, etc.).",
    },
    {
      key: "designPartnerObligations",
      label: "Design Partner Obligations",
      description:
        "What Design Partner contributes — feedback cadence, intros, case study, etc.",
    },
    {
      key: "feedbackRights",
      label: "Feedback Rights",
      description:
        "Provider's rights to use feedback (perpetual, royalty-free, etc.).",
    },
    {
      key: "fees",
      label: "Fees",
      description:
        "Discount / free access / standard fees — describe the commercial arrangement.",
    },
    {
      key: "programTerm",
      label: "Program Term",
      description: "How long the design-partner relationship runs.",
    },
    {
      key: "governingLaw",
      label: "Governing Law",
      description: "US state whose law governs.",
    },
  ],
});
