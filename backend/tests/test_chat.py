from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any

import pytest

from prelegal_backend import chat as chat_module
from prelegal_backend.chat import ChatMessage, handle_turn
from prelegal_backend.nda_schema import NdaData


def _empty_fields() -> NdaData:
    return NdaData.model_validate(
        {
            "purpose": "",
            "effectiveDate": "2026-05-23",
            "mndaTerm": {"kind": "years", "years": 1},
            "confidentialityTerm": {"kind": "years", "years": 1},
            "governingLaw": "",
            "jurisdiction": "",
            "modifications": "",
            "party1": {"name": "", "title": "", "company": "", "noticeAddress": "", "date": "2026-05-23"},
            "party2": {"name": "", "title": "", "company": "", "noticeAddress": "", "date": "2026-05-23"},
        }
    )


def _fake_completion(content: str):
    """Build a LiteLLM-shaped response object whose .choices[0].message.content is `content`."""

    return SimpleNamespace(
        choices=[
            SimpleNamespace(message=SimpleNamespace(content=content)),
        ]
    )


def test_handle_turn_merges_updated_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    def fake_completion(**kwargs):
        captured.update(kwargs)
        return _fake_completion(
            json.dumps(
                {
                    "assistant_message": "Got it — what state should govern?",
                    "updated_fields": {
                        "party1": {"company": "Acme Inc."},
                        "party2": {"company": "Globex Corp."},
                    },
                    "is_complete": False,
                }
            )
        )

    monkeypatch.setattr(chat_module, "completion", fake_completion)

    messages = [
        ChatMessage(role="assistant", content="Hi — who are the two parties?"),
        ChatMessage(role="user", content="Acme Inc. and Globex Corp."),
    ]
    response = handle_turn(messages, _empty_fields())

    assert response.assistant_message == "Got it — what state should govern?"
    assert response.merged_fields.party1.company == "Acme Inc."
    assert response.merged_fields.party2.company == "Globex Corp."
    assert response.merged_fields.governing_law == ""  # untouched
    assert response.is_complete is False

    # The provider routing block must be exactly what CLAUDE.md prescribes.
    assert captured["model"] == "openrouter/openai/gpt-oss-120b"
    assert captured["extra_body"] == {"provider": {"order": ["cerebras"]}}
    assert captured["reasoning_effort"] == "low"
    # response_format must be the ChatTurn class so LiteLLM can request
    # Structured Outputs from the provider.
    assert captured["response_format"] is chat_module.ChatTurn


def test_handle_turn_raises_502_on_empty_message(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        chat_module,
        "completion",
        lambda **_: _fake_completion(
            json.dumps(
                {
                    "assistant_message": "   ",
                    "updated_fields": {},
                    "is_complete": False,
                }
            )
        ),
    )

    with pytest.raises(chat_module.HTTPException) as exc:
        handle_turn([ChatMessage(role="user", content="hi")], _empty_fields())
    assert exc.value.status_code == 502
    assert "empty" in exc.value.detail.lower()


def test_handle_turn_raises_502_on_llm_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(**_):
        raise RuntimeError("openrouter exploded")

    monkeypatch.setattr(chat_module, "completion", boom)

    with pytest.raises(chat_module.HTTPException) as exc:
        handle_turn([ChatMessage(role="user", content="hi")], _empty_fields())
    assert exc.value.status_code == 502
    assert exc.value.detail == "AI service unavailable"


def test_handle_turn_raises_502_on_malformed_json(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        chat_module,
        "completion",
        lambda **_: _fake_completion("not json at all"),
    )

    with pytest.raises(chat_module.HTTPException) as exc:
        handle_turn([ChatMessage(role="user", content="hi")], _empty_fields())
    assert exc.value.status_code == 502
    assert "invalid" in exc.value.detail.lower()
