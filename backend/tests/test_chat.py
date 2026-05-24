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
