"""TemplateSpec for the Design Partner Agreement."""

from __future__ import annotations

from ..generic import FieldDef, build_generic_spec

MANIFEST: tuple[FieldDef, ...] = (
    FieldDef(
        key="effectiveDate",
        label="Effective Date",
        description="ISO yyyy-mm-dd.",
    ),
    FieldDef(
        key="programScope",
        label="Program Scope",
        description="What Provider gives Design Partner (early access, custom builds, etc.).",
    ),
    FieldDef(
        key="designPartnerObligations",
        label="Design Partner Obligations",
        description="What Design Partner contributes — feedback cadence, intros, case study, etc.",
    ),
    FieldDef(
        key="feedbackRights",
        label="Feedback Rights",
        description="Provider's rights to use feedback (perpetual, royalty-free, etc.).",
    ),
    FieldDef(
        key="fees",
        label="Fees",
        description="Discount / free access / standard fees — describe the commercial arrangement.",
    ),
    FieldDef(
        key="programTerm",
        label="Program Term",
        description="How long the design-partner relationship runs.",
    ),
    FieldDef(
        key="governingLaw",
        label="Governing Law",
        description="US state whose law governs.",
    ),
)


SPEC = build_generic_spec(
    slug="design-partner-agreement",
    name="Design Partner Agreement",
    description=(
        "Common Paper standard Design Partner Agreement for early-stage"
        " collaboration between a vendor and a design partner customer."
    ),
    manifest=MANIFEST,
    num_parties=2,
    greeting=(
        "Hi — I'll help you draft a Common Paper Design Partner Agreement."
        " Party 1 is the Provider (vendor) and Party 2 is the Design Partner"
        " (customer). What are the two company names?"
    ),
)
