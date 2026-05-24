import { buildGenericSpec } from "../generic/spec-builder";

export const spec = buildGenericSpec({
  slug: "dpa",
  name: "Data Processing Agreement",
  description:
    "Common Paper Data Processing Agreement for GDPR/CCPA-aligned processing of personal data between controller and processor.",
  filename: "DPA.md",
  pageSubtitle:
    "Tell the assistant about your data-processing arrangement — the preview fills in as you chat.",
  pdfFilenamePrefix: "DPA",
  greeting:
    "Hi — I'll help you draft a Common Paper DPA. Party 1 is the Controller (your customer) and Party 2 is the Processor. What are the two company names?",
  numParties: 2,
  manifest: [
    {
      key: "dpaEffectiveDate",
      label: "DPA Effective Date",
      description: "ISO yyyy-mm-dd.",
    },
    {
      key: "underlyingAgreement",
      label: "Underlying Agreement",
      description: "The commercial agreement this DPA attaches to.",
    },
    {
      key: "natureOfProcessing",
      label: "Nature of Processing",
      description:
        "Brief description of how Personal Data is processed under the services.",
    },
    {
      key: "categoriesOfData",
      label: "Categories of Personal Data",
      description:
        "The types of personal data Processor handles (e.g. names, emails, IP addresses).",
    },
    {
      key: "categoriesOfDataSubjects",
      label: "Categories of Data Subjects",
      description: "Who the data is about (e.g. Customer's end users, employees).",
    },
    {
      key: "duration",
      label: "Duration of Processing",
      description:
        "How long Processor processes data (typically 'duration of the underlying agreement').",
    },
    {
      key: "breachNotificationPeriod",
      label: "Breach Notification Period",
      description:
        "How quickly Processor must report a breach (e.g. '72 hours').",
    },
    {
      key: "governingLaw",
      label: "Governing Law",
      description:
        "Governing law (often inherits from the underlying agreement).",
    },
  ],
});
