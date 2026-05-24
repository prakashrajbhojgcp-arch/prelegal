"""TemplateSpec for the Service Level Agreement (SLA)."""

from __future__ import annotations

from ..generic import FieldDef, build_generic_spec

MANIFEST: tuple[FieldDef, ...] = (
    FieldDef(
        key="effectiveDate",
        label="Effective Date",
        description="ISO yyyy-mm-dd.",
    ),
    FieldDef(
        key="services",
        label="Covered Services",
        description="Which products / services this SLA covers.",
    ),
    FieldDef(
        key="uptimeCommitment",
        label="Uptime Commitment",
        description="Monthly availability target, e.g. '99.9%' or '99.95%'.",
    ),
    FieldDef(
        key="measurementPeriod",
        label="Measurement Period",
        description="How uptime is measured, e.g. 'calendar month'.",
    ),
    FieldDef(
        key="supportHours",
        label="Support Hours",
        description="Business hours support is offered, e.g. '9am–6pm ET, Mon–Fri'.",
    ),
    FieldDef(
        key="responseTimes",
        label="Response Times",
        description="Initial response targets by severity (e.g. 'P1: 1 hour, P2: 4 business hours').",
    ),
    FieldDef(
        key="serviceCredits",
        label="Service Credits",
        description="Credit schedule for missed targets (e.g. '10% for <99.9%, 25% for <99%').",
    ),
    FieldDef(
        key="exclusions",
        label="Exclusions",
        description="Downtime excluded from uptime (scheduled maintenance, force majeure, etc.).",
    ),
)


SPEC = build_generic_spec(
    slug="sla",
    name="Service Level Agreement",
    description=(
        "Common Paper standard Service Level Agreement, designed to be"
        " paired with the Cloud Service Agreement to define uptime and"
        " support commitments."
    ),
    manifest=MANIFEST,
    num_parties=2,
    greeting=(
        "Hi — I'll help you draft a Common Paper SLA. Party 1 is the"
        " Provider and Party 2 is the Customer. What are the two company"
        " names?"
    ),
)
