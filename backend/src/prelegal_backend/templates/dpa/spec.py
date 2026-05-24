"""TemplateSpec for the Data Processing Agreement (DPA)."""

from __future__ import annotations

from ..generic import FieldDef, build_generic_spec

MANIFEST: tuple[FieldDef, ...] = (
    FieldDef(
        key="dpaEffectiveDate",
        label="DPA Effective Date",
        description="ISO yyyy-mm-dd.",
    ),
    FieldDef(
        key="underlyingAgreement",
        label="Underlying Agreement",
        description="The commercial agreement this DPA attaches to.",
    ),
    FieldDef(
        key="natureOfProcessing",
        label="Nature of Processing",
        description="Brief description of how Personal Data is processed under the services.",
    ),
    FieldDef(
        key="categoriesOfData",
        label="Categories of Personal Data",
        description="The types of personal data Processor handles (e.g. names, emails, IP addresses).",
    ),
    FieldDef(
        key="categoriesOfDataSubjects",
        label="Categories of Data Subjects",
        description="Who the data is about (e.g. Customer's end users, employees).",
    ),
    FieldDef(
        key="duration",
        label="Duration of Processing",
        description="How long Processor processes data (typically 'duration of the underlying agreement').",
    ),
    FieldDef(
        key="breachNotificationPeriod",
        label="Breach Notification Period",
        description="How quickly Processor must report a breach (e.g. '72 hours').",
    ),
    FieldDef(
        key="governingLaw",
        label="Governing Law",
        description="Governing law (often inherits from the underlying agreement).",
    ),
)


SPEC = build_generic_spec(
    slug="dpa",
    name="Data Processing Agreement",
    description=(
        "Common Paper Data Processing Agreement for GDPR/CCPA-aligned"
        " processing of personal data between controller and processor."
    ),
    manifest=MANIFEST,
    num_parties=2,
    greeting=(
        "Hi — I'll help you draft a Common Paper DPA. Party 1 is the"
        " Controller (your customer) and Party 2 is the Processor (the"
        " vendor handling personal data). What are the two company names?"
    ),
)
