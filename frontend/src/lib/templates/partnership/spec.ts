import { buildGenericSpec } from "../generic/spec-builder";

export const spec = buildGenericSpec({
  slug: "partnership-agreement",
  name: "Partnership Agreement",
  description:
    "Common Paper standard Partnership Agreement governing reseller, referral, and other commercial partner relationships.",
  filename: "Partnership-Agreement.md",
  pageSubtitle:
    "Tell the assistant about your partnership — the preview fills in as you chat.",
  pdfFilenamePrefix: "Partnership-Agreement",
  greeting:
    "Hi — I'll help you draft a Common Paper Partnership Agreement. Party 1 is the Company (product owner) and Party 2 is the Partner. What are the two company names?",
  numParties: 2,
  manifest: [
    {
      key: "effectiveDate",
      label: "Effective Date",
      description: "ISO yyyy-mm-dd.",
    },
    {
      key: "partnershipType",
      label: "Partnership Type",
      description: "Reseller, referral, distribution, etc.",
    },
    {
      key: "territory",
      label: "Territory",
      description: "Geographic / market scope of the partnership.",
    },
    {
      key: "exclusivity",
      label: "Exclusivity",
      description:
        "Is the partnership exclusive in its territory? Either party? Neither?",
    },
    {
      key: "commissionStructure",
      label: "Commission Structure",
      description:
        "How Partner earns money — percentage, tiers, recurring revenue share, etc.",
    },
    {
      key: "agreementTerm",
      label: "Agreement Term",
      description: "Initial term length.",
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
  ],
});
