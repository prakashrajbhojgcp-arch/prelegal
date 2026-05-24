import { buildGenericSpec } from "../generic/spec-builder";

export const spec = buildGenericSpec({
  slug: "sla",
  name: "Service Level Agreement",
  description:
    "Common Paper standard Service Level Agreement, designed to be paired with the Cloud Service Agreement to define uptime and support commitments.",
  filename: "SLA.md",
  pageSubtitle:
    "Tell the assistant about your uptime and support commitments — the preview fills in as you chat.",
  pdfFilenamePrefix: "SLA",
  greeting:
    "Hi — I'll help you draft a Common Paper SLA. Party 1 is the Provider and Party 2 is the Customer. What are the two company names?",
  numParties: 2,
  manifest: [
    {
      key: "effectiveDate",
      label: "Effective Date",
      description: "ISO yyyy-mm-dd.",
    },
    {
      key: "services",
      label: "Covered Services",
      description: "Which products / services this SLA covers.",
    },
    {
      key: "uptimeCommitment",
      label: "Uptime Commitment",
      description: "Monthly availability target, e.g. '99.9%' or '99.95%'.",
    },
    {
      key: "measurementPeriod",
      label: "Measurement Period",
      description: "How uptime is measured, e.g. 'calendar month'.",
    },
    {
      key: "supportHours",
      label: "Support Hours",
      description: "Business hours support is offered, e.g. '9am–6pm ET, Mon–Fri'.",
    },
    {
      key: "responseTimes",
      label: "Response Times",
      description:
        "Initial response targets by severity (e.g. 'P1: 1 hour, P2: 4 business hours').",
    },
    {
      key: "serviceCredits",
      label: "Service Credits",
      description:
        "Credit schedule for missed targets (e.g. '10% for <99.9%, 25% for <99%').",
    },
    {
      key: "exclusions",
      label: "Exclusions",
      description:
        "Downtime excluded from uptime (scheduled maintenance, force majeure, etc.).",
    },
  ],
});
