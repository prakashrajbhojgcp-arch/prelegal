"""TemplateSpec for the Pilot Agreement."""

from __future__ import annotations

from ..generic import FieldDef, build_generic_spec

MANIFEST: tuple[FieldDef, ...] = (
    FieldDef(
        key="effectiveDate",
        label="Effective Date",
        description="ISO yyyy-mm-dd.",
    ),
    FieldDef(
        key="pilotScope",
        label="Pilot Scope",
        description="What Provider will give Customer to evaluate during the pilot.",
    ),
    FieldDef(
        key="successCriteria",
        label="Success Criteria",
        description="What 'good' looks like at the end of the pilot.",
    ),
    FieldDef(
        key="pilotPeriod",
        label="Pilot Period",
        description="Duration of the pilot, e.g. '60 days', '3 months'.",
    ),
    FieldDef(
        key="fees",
        label="Pilot Fees",
        description="Cost of the pilot itself — may be zero, fixed, or credit toward a future contract.",
    ),
    FieldDef(
        key="conversion",
        label="Conversion",
        description="What happens at the end — auto-renew, convert to paid, terminate, etc.",
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
    slug="pilot-agreement",
    name="Pilot Agreement",
    description=(
        "Common Paper standard Pilot Agreement: a short-term contract for"
        " trials/evaluations of a product before a full commercial deal."
    ),
    manifest=MANIFEST,
    num_parties=2,
    greeting=(
        "Hi — I'll help you draft a Common Paper Pilot Agreement. Party 1"
        " is the Provider (vendor) and Party 2 is the Customer. What are"
        " the two company names?"
    ),
)
