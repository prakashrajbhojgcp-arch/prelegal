import { buildGenericSpec } from "../generic/spec-builder";

export const spec = buildGenericSpec({
  slug: "pilot-agreement",
  name: "Pilot Agreement",
  description:
    "Common Paper standard Pilot Agreement: a short-term contract for trials/evaluations of a product before a full commercial deal.",
  filename: "Pilot-Agreement.md",
  pageSubtitle:
    "Tell the assistant about your pilot — the preview fills in as you chat.",
  pdfFilenamePrefix: "Pilot-Agreement",
  greeting:
    "Hi — I'll help you draft a Common Paper Pilot Agreement. Party 1 is the Provider (vendor) and Party 2 is the Customer. What are the two company names?",
  numParties: 2,
  manifest: [
    {
      key: "effectiveDate",
      label: "Effective Date",
      description: "ISO yyyy-mm-dd.",
    },
    {
      key: "pilotScope",
      label: "Pilot Scope",
      description: "What Provider will give Customer to evaluate during the pilot.",
    },
    {
      key: "successCriteria",
      label: "Success Criteria",
      description: "What 'good' looks like at the end of the pilot.",
    },
    {
      key: "pilotPeriod",
      label: "Pilot Period",
      description: "Duration of the pilot, e.g. '60 days', '3 months'.",
    },
    {
      key: "fees",
      label: "Pilot Fees",
      description:
        "Cost of the pilot itself — may be zero, fixed, or credit toward a future contract.",
    },
    {
      key: "conversion",
      label: "Conversion",
      description:
        "What happens at the end — auto-renew, convert to paid, terminate, etc.",
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
