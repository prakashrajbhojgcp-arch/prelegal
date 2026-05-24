import { buildGenericSpec } from "../generic/spec-builder";

export const spec = buildGenericSpec({
  slug: "psa",
  name: "Professional Services Agreement",
  description:
    "Common Paper standard Professional Services Agreement for engagements involving SOWs and deliverables.",
  filename: "PSA.md",
  pageSubtitle:
    "Tell the assistant about your services engagement — the preview fills in as you chat.",
  pdfFilenamePrefix: "PSA",
  greeting:
    "Hi — I'll help you draft a Common Paper PSA. Party 1 is the Provider and Party 2 is the Customer. What are the two company names?",
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
      description:
        "High-level description of the professional services Provider performs.",
    },
    {
      key: "deliverables",
      label: "Deliverables",
      description:
        "What Provider produces under SOWs (reports, code, etc.).",
    },
    {
      key: "fees",
      label: "Fees",
      description: "Pricing model — fixed fee, time-and-materials, hourly rate.",
    },
    {
      key: "expensesPolicy",
      label: "Expenses Policy",
      description:
        "Are reasonable expenses reimbursable? With or without pre-approval?",
    },
    {
      key: "agreementTerm",
      label: "Agreement Term",
      description: "Initial term length, e.g. '1 year', '24 months'.",
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
