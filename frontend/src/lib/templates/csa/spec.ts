import { buildGenericSpec } from "../generic/spec-builder";

export const spec = buildGenericSpec({
  slug: "csa",
  name: "Cloud Service Agreement",
  description:
    "Common Paper standard Cloud Service Agreement for selling and buying cloud software and SaaS products.",
  filename: "CSA.md",
  pageSubtitle:
    "Tell the assistant about your cloud deal — the preview fills in as you chat.",
  pdfFilenamePrefix: "CSA",
  greeting:
    "Hi — I'll help you draft a Common Paper Cloud Service Agreement. Party 1 is the Provider (vendor) and Party 2 is the Customer. What are the two company names?",
  numParties: 2,
  manifest: [
    {
      key: "effectiveDate",
      label: "Effective Date",
      description: "ISO yyyy-mm-dd.",
    },
    {
      key: "services",
      label: "Services",
      description: "What Provider's cloud product does, in one or two sentences.",
    },
    {
      key: "fees",
      label: "Fees",
      description: "Pricing summary (e.g. '$2,500/month', '$30,000/year').",
    },
    {
      key: "paymentPeriod",
      label: "Payment Period",
      description: "Billing cadence — e.g. 'monthly', 'annual in advance'.",
    },
    {
      key: "agreementTerm",
      label: "Agreement Term",
      description: "Initial term length, e.g. '1 year', '24 months'.",
    },
    {
      key: "renewalTerm",
      label: "Renewal Term",
      description:
        "Renewal behavior, e.g. 'auto-renews for 1-year terms unless cancelled 30 days prior'.",
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
