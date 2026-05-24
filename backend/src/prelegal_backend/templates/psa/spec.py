"""TemplateSpec for the Professional Services Agreement (PSA)."""

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
        description="High-level description of the professional services Provider performs.",
    ),
    FieldDef(
        key="deliverables",
        label="Deliverables",
        description="What Provider produces under SOWs (reports, code, etc.).",
    ),
    FieldDef(
        key="fees",
        label="Fees",
        description="Pricing model — fixed fee, time-and-materials, hourly rate.",
    ),
    FieldDef(
        key="expensesPolicy",
        label="Expenses Policy",
        description="Are reasonable expenses reimbursable? With or without pre-approval?",
    ),
    FieldDef(
        key="agreementTerm",
        label="Agreement Term",
        description="Initial term length, e.g. '1 year', '24 months'.",
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
    slug="psa",
    name="Professional Services Agreement",
    description=(
        "Common Paper standard Professional Services Agreement for"
        " engagements involving SOWs and deliverables."
    ),
    manifest=MANIFEST,
    num_parties=2,
    greeting=(
        "Hi — I'll help you draft a Common Paper PSA. Party 1 is the"
        " Provider and Party 2 is the Customer. What are the two company"
        " names?"
    ),
)
