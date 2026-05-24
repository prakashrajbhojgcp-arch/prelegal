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


def test_handle_turn_caps_history_at_60(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    def fake(**kwargs):
        captured.update(kwargs)
        return _fake_completion(
            json.dumps(
                {
                    "assistant_message": "ok",
                    "updated_fields": {},
                    "is_complete": False,
                }
            )
        )

    monkeypatch.setattr(chat_module, "completion", fake)

    # 100 user/assistant alternating messages — the cap should keep the last 60.
    history = [
        ChatMessage(role="user" if i % 2 == 0 else "assistant", content=f"msg-{i}")
        for i in range(100)
    ]
    handle_turn(history, _empty_fields())

    forwarded = captured["messages"]
    # 1 system + at most MAX_HISTORY (60) chat messages
    assert forwarded[0]["role"] == "system"
    assert len(forwarded) - 1 == chat_module.MAX_HISTORY
    # The kept slice is the most-recent 60: msg-40 through msg-99.
    assert forwarded[1]["content"] == "msg-40"
    assert forwarded[-1]["content"] == "msg-99"


def _sample_request_body() -> dict:
    return {
        "messages": [
            {"role": "assistant", "content": "Hi — who are the two parties?"},
            {"role": "user", "content": "Acme and Globex."},
        ],
        "current_fields": {
            "purpose": "",
            "effectiveDate": "2026-05-23",
            "mndaTerm": {"kind": "years", "years": 1},
            "confidentialityTerm": {"kind": "years", "years": 1},
            "governingLaw": "",
            "jurisdiction": "",
            "modifications": "",
            "party1": {"name": "", "title": "", "company": "", "noticeAddress": "", "date": "2026-05-23"},
            "party2": {"name": "", "title": "", "company": "", "noticeAddress": "", "date": "2026-05-23"},
        },
    }


def test_chat_endpoint_requires_auth(client) -> None:
    response = client.post("/api/templates/mutual-nda/chat", json=_sample_request_body())
    assert response.status_code == 401


def test_chat_endpoint_happy_path(monkeypatch: pytest.MonkeyPatch, auth_client) -> None:
    monkeypatch.setattr(
        chat_module,
        "completion",
        lambda **_: _fake_completion(
            json.dumps(
                {
                    "assistant_message": "What state should govern?",
                    "updated_fields": {"party1": {"company": "Acme"}},
                    "is_complete": False,
                }
            )
        ),
    )

    response = auth_client.post(
        "/api/templates/mutual-nda/chat",
        json=_sample_request_body(),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["assistantMessage"] == "What state should govern?"
    assert body["mergedFields"]["party1"]["company"] == "Acme"
    assert body["isComplete"] is False


def test_chat_endpoint_propagates_502_on_llm_error(monkeypatch, auth_client) -> None:
    def boom(**_):
        raise RuntimeError("openrouter exploded")

    monkeypatch.setattr(chat_module, "completion", boom)

    response = auth_client.post(
        "/api/templates/mutual-nda/chat",
        json=_sample_request_body(),
    )
    assert response.status_code == 502
    assert response.json()["detail"] == "AI service unavailable"
