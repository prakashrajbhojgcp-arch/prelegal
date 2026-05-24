import { buildGenericSpec } from "../generic/spec-builder";

export const spec = buildGenericSpec({
  slug: "ai-addendum",
  name: "AI Addendum",
  description:
    "Common Paper standard AI Addendum: an add-on for existing commercial agreements that addresses AI-specific obligations such as training data, model use, and outputs.",
  filename: "AI-Addendum.md",
  pageSubtitle:
    "Tell the assistant about your AI features — the preview fills in as you chat.",
  pdfFilenamePrefix: "AI-Addendum",
  greeting:
    "Hi — I'll help you draft a Common Paper AI Addendum. Party 1 is the Provider and Party 2 is the Customer. What are the two company names, and which existing agreement does this addendum attach to?",
  numParties: 2,
  manifest: [
    {
      key: "addendumEffectiveDate",
      label: "Addendum Effective Date",
      description: "ISO yyyy-mm-dd.",
    },
    {
      key: "underlyingAgreement",
      label: "Underlying Agreement",
      description: "The commercial agreement this AI Addendum modifies.",
    },
    {
      key: "aiFeatures",
      label: "AI Features",
      description:
        "The AI-powered features Provider offers under this addendum.",
    },
    {
      key: "trainingDataRestriction",
      label: "Training Data Restriction",
      description:
        "Whether Provider may use Customer Data to train models — 'no', 'only with explicit opt-in', 'yes'.",
    },
    {
      key: "outputOwnership",
      label: "Output Ownership",
      description: "Who owns AI outputs — Customer, Provider, or shared.",
    },
    {
      key: "subprocessors",
      label: "AI Subprocessors",
      description:
        "Third-party AI providers used (OpenAI, Anthropic, etc.). Empty means none.",
    },
    {
      key: "acceptableUse",
      label: "Acceptable Use",
      description:
        "Use cases Customer must avoid (e.g. high-risk decisions without human review).",
    },
  ],
});
