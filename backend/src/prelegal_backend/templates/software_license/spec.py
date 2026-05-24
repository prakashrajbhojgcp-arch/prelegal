"""TemplateSpec for the Software License Agreement."""

from __future__ import annotations

from ..generic import FieldDef, build_generic_spec

MANIFEST: tuple[FieldDef, ...] = (
    FieldDef(
        key="effectiveDate",
        label="Effective Date",
        description="ISO yyyy-mm-dd.",
    ),
    FieldDef(
        key="software",
        label="Software",
        description="Name and short description of the licensed software.",
    ),
    FieldDef(
        key="licenseType",
        label="License Type",
        description=(
            "Scope of the license — e.g. 'non-exclusive, non-transferable,"
            " perpetual', 'subscription with annual term'."
        ),
    ),
    FieldDef(
        key="permittedUse",
        label="Permitted Use",
        description="What Customer is allowed to do with the software (internal use, redistribution, etc.).",
    ),
    FieldDef(
        key="restrictions",
        label="Restrictions",
        description="Specific restrictions (no reverse engineering, no resale, etc.).",
    ),
    FieldDef(
        key="fees",
        label="Fees",
        description="License fees (one-time, subscription, per-seat, etc.).",
    ),
    FieldDef(
        key="agreementTerm",
        label="Agreement Term",
        description="Term of the agreement, e.g. 'perpetual', '1-year subscription'.",
    ),
    FieldDef(
        key="governingLaw",
        label="Governing Law",
        description="US state whose law governs.",
    ),
)


SPEC = build_generic_spec(
    slug="software-license-agreement",
    name="Software License Agreement",
    description=(
        "Common Paper standard Software License Agreement for licensing"
        " on-premises or downloadable software."
    ),
    manifest=MANIFEST,
    num_parties=2,
    greeting=(
        "Hi — I'll help you draft a Common Paper Software License"
        " Agreement. Party 1 is the Provider (licensor) and Party 2 is the"
        " Customer (licensee). What are the two company names?"
    ),
)
