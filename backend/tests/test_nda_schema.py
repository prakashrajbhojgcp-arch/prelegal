from __future__ import annotations

import pytest
from pydantic import ValidationError

from prelegal_backend.nda_schema import (
    NdaData,
    Party,
    MndaTerm,
    ConfidentialityTerm,
)


def _sample_nda_data_wire() -> dict:
    """The exact JSON shape the TS frontend sends (camelCase)."""
    return {
        "purpose": "Evaluating a deal.",
        "effectiveDate": "2026-05-23",
        "mndaTerm": {"kind": "years", "years": 2},
        "confidentialityTerm": {"kind": "perpetuity"},
        "governingLaw": "Delaware",
        "jurisdiction": "New Castle, DE",
        "modifications": "",
        "party1": {
            "name": "Ada Lovelace",
            "title": "CEO",
            "company": "Acme Inc.",
            "noticeAddress": "1 Main St",
            "date": "2026-05-23",
        },
        "party2": {
            "name": "Grace Hopper",
            "title": "CTO",
            "company": "Globex Corp.",
            "noticeAddress": "ada@globex.com",
            "date": "2026-05-23",
        },
    }


def test_nda_data_round_trips_through_wire_shape() -> None:
    wire = _sample_nda_data_wire()
    parsed = NdaData.model_validate(wire)
    assert parsed.governing_law == "Delaware"
    assert parsed.party1.notice_address == "1 Main St"
    assert isinstance(parsed.mnda_term, MndaTerm)
    assert parsed.mnda_term.kind == "years"
    assert parsed.mnda_term.years == 2
    assert parsed.confidentiality_term.kind == "perpetuity"
    # dump back to the wire shape and confirm camelCase keys round-trip
    dumped = parsed.model_dump(by_alias=True, exclude_none=True)
    assert dumped["governingLaw"] == "Delaware"
    assert dumped["party1"]["noticeAddress"] == "1 Main St"


def test_mnda_term_rejects_bad_kind() -> None:
    with pytest.raises(ValidationError):
        MndaTerm.model_validate({"kind": "centuries", "years": 100})


def test_confidentiality_term_rejects_bad_kind() -> None:
    with pytest.raises(ValidationError):
        ConfidentialityTerm.model_validate({"kind": "untilTerminated"})


def test_mnda_term_years_required_when_kind_is_years() -> None:
    with pytest.raises(ValidationError):
        MndaTerm.model_validate({"kind": "years"})


def test_party_round_trip_camel_case() -> None:
    raw = {
        "name": "x",
        "title": "y",
        "company": "z",
        "noticeAddress": "a",
        "date": "2026-05-23",
    }
    p = Party.model_validate(raw)
    assert p.notice_address == "a"
    assert p.model_dump(by_alias=True)["noticeAddress"] == "a"
