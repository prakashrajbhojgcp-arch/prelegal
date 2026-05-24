"""TemplateSpec for the Mutual NDA Cover Page (stand-alone)."""

from __future__ import annotations

from ..generic import FieldDef, build_generic_spec

MANIFEST: tuple[FieldDef, ...] = (
    FieldDef(
        key="purpose",
        label="Purpose",
        description="Why the parties are exchanging confidential information.",
    ),
    FieldDef(
        key="effectiveDate",
        label="Effective Date",
        description="ISO yyyy-mm-dd.",
    ),
    FieldDef(
        key="mndaTerm",
        label="MNDA Term",
        description="How long the MNDA itself stays in force (e.g. '1 year', 'until terminated').",
    ),
    FieldDef(
        key="confidentialityTerm",
        label="Term of Confidentiality",
        description="How long confidentiality obligations last (e.g. '2 years', 'in perpetuity').",
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
    FieldDef(
        key="modifications",
        label="MNDA Modifications",
        description="Any tweaks to the standard MNDA terms. Empty means none.",
    ),
)


SPEC = build_generic_spec(
    slug="mutual-nda-coverpage",
    name="Mutual NDA — Cover Page",
    description=(
        "Cover Page for the Common Paper Mutual NDA. Capture counterparty"
        " details and signatures; incorporates the MNDA Standard Terms by"
        " reference."
    ),
    manifest=MANIFEST,
    num_parties=2,
    greeting=(
        "Hi — I'll help you draft a stand-alone Cover Page for the Common"
        " Paper Mutual NDA. What are the two company names?"
    ),
)
