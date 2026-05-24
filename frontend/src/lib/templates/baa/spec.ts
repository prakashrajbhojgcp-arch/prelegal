import { buildGenericSpec } from "../generic/spec-builder";

export const spec = buildGenericSpec({
  slug: "baa",
  name: "Business Associate Agreement",
  description:
    "Common Paper standard Business Associate Agreement covering HIPAA obligations when handling Protected Health Information.",
  filename: "BAA.md",
  pageSubtitle:
    "Tell the assistant about your HIPAA arrangement — the preview fills in as you chat.",
  pdfFilenamePrefix: "BAA",
  greeting:
    "Hi — I'll help you draft a Common Paper BAA. Party 1 is the Provider (business associate) and Party 2 is the Company (covered entity). To start: what are the two organization names?",
  numParties: 2,
  manifest: [
    {
      key: "baaEffectiveDate",
      label: "BAA Effective Date",
      description: "ISO yyyy-mm-dd. The date this BAA starts.",
    },
    {
      key: "underlyingAgreement",
      label: "Underlying Agreement",
      description:
        "The commercial agreement this BAA attaches to (e.g. 'Cloud Service Agreement dated 2026-01-15').",
    },
    {
      key: "services",
      label: "Services",
      description:
        "Short description of the services Provider performs that may involve PHI.",
    },
    {
      key: "limitations",
      label: "Limitations",
      description:
        "Any restrictions on PHI use (e.g. 'no offshore processing'). Free text; empty means none.",
    },
    {
      key: "breachNotificationPeriod",
      label: "Breach Notification Period",
      description:
        "How quickly Provider must report a breach (e.g. '5 business days').",
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
