import { buildGenericSpec } from "../generic/spec-builder";

export const spec = buildGenericSpec({
  slug: "software-license-agreement",
  name: "Software License Agreement",
  description:
    "Common Paper standard Software License Agreement for licensing on-premises or downloadable software.",
  filename: "Software-License-Agreement.md",
  pageSubtitle:
    "Tell the assistant about your software license — the preview fills in as you chat.",
  pdfFilenamePrefix: "Software-License-Agreement",
  greeting:
    "Hi — I'll help you draft a Common Paper Software License Agreement. Party 1 is the Provider (licensor) and Party 2 is the Customer (licensee). What are the two company names?",
  numParties: 2,
  manifest: [
    {
      key: "effectiveDate",
      label: "Effective Date",
      description: "ISO yyyy-mm-dd.",
    },
    {
      key: "software",
      label: "Software",
      description: "Name and short description of the licensed software.",
    },
    {
      key: "licenseType",
      label: "License Type",
      description:
        "Scope of the license — e.g. 'non-exclusive, non-transferable, perpetual', 'subscription with annual term'.",
    },
    {
      key: "permittedUse",
      label: "Permitted Use",
      description:
        "What Customer is allowed to do with the software (internal use, redistribution, etc.).",
    },
    {
      key: "restrictions",
      label: "Restrictions",
      description:
        "Specific restrictions (no reverse engineering, no resale, etc.).",
    },
    {
      key: "fees",
      label: "Fees",
      description: "License fees (one-time, subscription, per-seat, etc.).",
    },
    {
      key: "agreementTerm",
      label: "Agreement Term",
      description: "Term of the agreement, e.g. 'perpetual', '1-year subscription'.",
    },
    {
      key: "governingLaw",
      label: "Governing Law",
      description: "US state whose law governs.",
    },
  ],
});
