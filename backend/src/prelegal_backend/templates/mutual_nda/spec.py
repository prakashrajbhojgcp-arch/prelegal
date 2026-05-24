"""TemplateSpec for the Mutual NDA."""

from __future__ import annotations

from datetime import date

from ..specs import TemplateSpec, register
from .schema import (
    ConfidentialityTerm,
    MndaTerm,
    NdaData,
    PartialNdaData,
    Party,
    deep_merge_fields,
)


DEFAULT_PURPOSE = (
    "Evaluating whether to enter into a business relationship with the other party."
)


def _today_iso() -> str:
    return date.today().isoformat()


def _empty_party() -> Party:
    return Party(
        name="",
        title="",
        company="",
        notice_address="",
        date=_today_iso(),
    )


def default_nda_data() -> NdaData:
    return NdaData(
        purpose=DEFAULT_PURPOSE,
        effective_date=_today_iso(),
        mnda_term=MndaTerm.model_validate({"kind": "years", "years": 1}),
        confidentiality_term=ConfidentialityTerm.model_validate(
            {"kind": "years", "years": 1}
        ),
        governing_law="",
        jurisdiction="",
        modifications="",
        party1=_empty_party(),
        party2=_empty_party(),
    )


def system_prompt(current_fields: NdaData) -> str:
    snapshot = current_fields.model_dump_json(by_alias=True, indent=2)
    return (
        "You are helping the user draft a Common Paper Mutual Non-Disclosure "
        "Agreement (Version 1.0).\n"
        "\n"
        "Collect these fields by asking short, friendly questions — one or two "
        "fields at a time. Never fire-hose:\n"
        "- purpose (one sentence on how Confidential Information may be used)\n"
        "- effectiveDate (ISO yyyy-mm-dd)\n"
        "- mndaTerm: either {kind:'years', years:N} or {kind:'untilTerminated'}\n"
        "- confidentialityTerm: either {kind:'years', years:N} or {kind:'perpetuity'}\n"
        "- governingLaw (US state)\n"
        "- jurisdiction (city/county + state)\n"
        "- modifications (free text or empty if none)\n"
        "- party1, party2: each has name, title, company, noticeAddress, date (ISO)\n"
        "\n"
        "Document state so far:\n"
        f"{snapshot}\n"
        "\n"
        "Only populate `updated_fields` with values the latest user message "
        "clarified — do NOT echo state back. Leave a leaf out (or send null) if "
        "the user did not just answer it. Set is_complete=true once every "
        "field above is non-empty AND you have confirmed the draft with the "
        "user. Otherwise is_complete=false."
    )


GREETING = (
    "Hi — I'll help you draft a Common Paper Mutual NDA. To start: what are the"
    " names of the two companies entering this agreement?"
)


SPEC: TemplateSpec[NdaData, PartialNdaData] = register(
    TemplateSpec(
        slug="mutual-nda",
        name="Mutual NDA",
        data_model=NdaData,
        partial_model=PartialNdaData,
        default_data=default_nda_data,
        deep_merge=deep_merge_fields,
        system_prompt=system_prompt,
        greeting=GREETING,
    )
)
