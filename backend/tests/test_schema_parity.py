from __future__ import annotations

import json
from pathlib import Path

from prelegal_backend.nda_schema import NdaData

FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "frontend"
    / "src"
    / "lib"
    / "__tests__"
    / "nda-schema-parity.fixture.json"
)


def test_pydantic_accepts_the_shared_fixture() -> None:
    payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    parsed = NdaData.model_validate(payload)
    # round-trip back to wire shape and confirm key-by-key equality
    dumped = parsed.model_dump(by_alias=True, exclude_none=True)
    assert dumped == payload
