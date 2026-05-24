"""TemplateSpec for the Business Associate Agreement (BAA)."""

from __future__ import annotations

from ..generic import FieldDef, build_generic_spec

MANIFEST: tuple[FieldDef, ...] = (
    FieldDef(
        key="baaEffectiveDate",
        label="BAA Effective Date",
        description="ISO yyyy-mm-dd. The date this BAA starts.",
    ),
    FieldDef(
        key="underlyingAgreement",
        label="Underlying Agreement",
        description=(
            "The commercial agreement this BAA attaches to (e.g. 'Cloud"
            " Service Agreement dated 2026-01-15')."
        ),
    ),
    FieldDef(
        key="services",
        label="Services",
        description="Short description of the services Provider performs that may involve PHI.",
    ),
    FieldDef(
        key="limitations",
        label="Limitations",
        description=(
            "Any restrictions on PHI use (e.g. 'no offshore processing',"
            " 'no aggregation'). Free text; empty means none."
        ),
    ),
    FieldDef(
        key="breachNotificationPeriod",
        label="Breach Notification Period",
        description="How quickly Provider must report a breach (e.g. '5 business days').",
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
    slug="baa",
    name="Business Associate Agreement",
    description=(
        "Common Paper standard Business Associate Agreement covering HIPAA"
        " obligations when handling Protected Health Information."
    ),
    manifest=MANIFEST,
    num_parties=2,
    greeting=(
        "Hi — I'll help you draft a Common Paper BAA. Party 1 is the"
        " Provider (business associate) and Party 2 is the Company (covered"
        " entity). To start: what are the names of the two organizations?"
    ),
)
