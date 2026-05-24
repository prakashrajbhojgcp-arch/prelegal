"""TemplateSpec for the Partnership Agreement."""

from __future__ import annotations

from ..generic import FieldDef, build_generic_spec

MANIFEST: tuple[FieldDef, ...] = (
    FieldDef(
        key="effectiveDate",
        label="Effective Date",
        description="ISO yyyy-mm-dd.",
    ),
    FieldDef(
        key="partnershipType",
        label="Partnership Type",
        description="Reseller, referral, distribution, etc.",
    ),
    FieldDef(
        key="territory",
        label="Territory",
        description="Geographic / market scope of the partnership.",
    ),
    FieldDef(
        key="exclusivity",
        label="Exclusivity",
        description="Is the partnership exclusive in its territory? Either party? Neither?",
    ),
    FieldDef(
        key="commissionStructure",
        label="Commission Structure",
        description="How Partner earns money — percentage, tiers, recurring revenue share, etc.",
    ),
    FieldDef(
        key="agreementTerm",
        label="Agreement Term",
        description="Initial term length.",
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
    slug="partnership-agreement",
    name="Partnership Agreement",
    description=(
        "Common Paper standard Partnership Agreement governing reseller,"
        " referral, and other commercial partner relationships."
    ),
    manifest=MANIFEST,
    num_parties=2,
    greeting=(
        "Hi — I'll help you draft a Common Paper Partnership Agreement."
        " Party 1 is the Company (product owner) and Party 2 is the Partner."
        " What are the two company names?"
    ),
)
