"""TemplateSpec for the AI Addendum."""

from __future__ import annotations

from ..generic import FieldDef, build_generic_spec

MANIFEST: tuple[FieldDef, ...] = (
    FieldDef(
        key="addendumEffectiveDate",
        label="Addendum Effective Date",
        description="ISO yyyy-mm-dd.",
    ),
    FieldDef(
        key="underlyingAgreement",
        label="Underlying Agreement",
        description="The commercial agreement this AI Addendum modifies.",
    ),
    FieldDef(
        key="aiFeatures",
        label="AI Features",
        description="The AI-powered features Provider offers under this addendum.",
    ),
    FieldDef(
        key="trainingDataRestriction",
        label="Training Data Restriction",
        description=(
            "Whether Provider may use Customer Data to train models —"
            " typical answers: 'no', 'only with explicit opt-in', 'yes'."
        ),
    ),
    FieldDef(
        key="outputOwnership",
        label="Output Ownership",
        description="Who owns AI outputs — Customer, Provider, or shared.",
    ),
    FieldDef(
        key="subprocessors",
        label="AI Subprocessors",
        description="Third-party AI providers used (OpenAI, Anthropic, etc.). Empty means none.",
    ),
    FieldDef(
        key="acceptableUse",
        label="Acceptable Use",
        description="Use cases Customer must avoid (e.g. high-risk decisions without human review).",
    ),
)


SPEC = build_generic_spec(
    slug="ai-addendum",
    name="AI Addendum",
    description=(
        "Common Paper standard AI Addendum: an add-on for existing"
        " commercial agreements that addresses AI-specific obligations"
        " such as training data, model use, and outputs."
    ),
    manifest=MANIFEST,
    num_parties=2,
    greeting=(
        "Hi — I'll help you draft a Common Paper AI Addendum. Party 1 is"
        " the Provider and Party 2 is the Customer. What are the two"
        " company names, and which existing agreement does this addendum"
        " attach to?"
    ),
)
