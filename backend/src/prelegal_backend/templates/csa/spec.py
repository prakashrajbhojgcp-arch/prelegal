"""TemplateSpec for the Cloud Service Agreement (CSA)."""

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
        label="Services",
        description="What Provider's cloud product does, in one or two sentences.",
    ),
    FieldDef(
        key="fees",
        label="Fees",
        description="Pricing summary (e.g. '$2,500/month', '$30,000/year').",
    ),
    FieldDef(
        key="paymentPeriod",
        label="Payment Period",
        description="Billing cadence — e.g. 'monthly', 'annual in advance'.",
    ),
    FieldDef(
        key="agreementTerm",
        label="Agreement Term",
        description="Initial term length, e.g. '1 year', '24 months'.",
    ),
    FieldDef(
        key="renewalTerm",
        label="Renewal Term",
        description="Renewal behavior, e.g. 'auto-renews for 1-year terms unless cancelled 30 days prior'.",
    ),
    FieldDef(
        key="governingLaw",
        label="Governing Law",
        description="US state whose law governs.",
    ),
    FieldDef(
        key="jurisdiction",
        label="Jurisdiction",
        description="City/county and state for dispute venue.",
    ),
)


SPEC = build_generic_spec(
    slug="csa",
    name="Cloud Service Agreement",
    description=(
        "Common Paper standard Cloud Service Agreement for selling and"
        " buying cloud software and SaaS products."
    ),
    manifest=MANIFEST,
    num_parties=2,
    greeting=(
        "Hi — I'll help you draft a Common Paper Cloud Service Agreement."
        " Party 1 is the Provider (vendor) and Party 2 is the Customer. To"
        " start: what are the two company names?"
    ),
)
