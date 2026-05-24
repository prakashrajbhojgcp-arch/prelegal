# PL-5: AI chat for Mutual NDA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the form-driven Mutual NDA creator at `/dashboard/templates/mutual-nda` with a free-form AI chat that asks about each field and populates the same `NdaData` model. Live preview + client-side PDF download stay; the old `NdaForm` survives behind a collapsible "Edit fields manually" panel.

**Architecture:** Single Structured-Outputs round-trip per chat turn. Frontend `NdaChatApp` owns chat thread + `NdaData` state; on each user message it POSTs `{messages, current_fields}` to a new FastAPI endpoint `/api/templates/mutual-nda/chat`. The backend builds a system prompt containing a snapshot of `current_fields`, calls `litellm.completion(...)` with `response_format=ChatTurn` (Cerebras provider, `openrouter/openai/gpt-oss-120b`), deep-merges the model's `updated_fields` into `current_fields`, and returns the merged state + assistant message. No persistence, no streaming.

**Tech Stack:** FastAPI · Pydantic · LiteLLM via OpenRouter (Cerebras provider, `openrouter/openai/gpt-oss-120b`) · Next.js 16 (App Router) · React 19 · Vitest + @testing-library/react · Playwright · `@react-pdf/renderer` (unchanged).

**Spec:** `docs/superpowers/specs/2026-05-23-pl5-ai-chat-mutual-nda-design.md`

---

## File structure

**Backend — create:**
- `backend/src/prelegal_backend/nda_schema.py` — Pydantic mirror of TS `NdaData` + `PartialNdaData` + `deep_merge_fields()`.
- `backend/src/prelegal_backend/chat.py` — FastAPI router with `POST /api/templates/mutual-nda/chat`, `handle_turn()`, system-prompt builder, `ChatTurn` Structured-Outputs schema.
- `backend/tests/test_nda_schema.py`
- `backend/tests/test_chat.py`

**Backend — modify:**
- `backend/pyproject.toml` — add `litellm` and `python-dotenv` dependencies.
- `backend/src/prelegal_backend/main.py` — include `chat.router`.
- `backend/tests/conftest.py` — add `auth_client` fixture that returns a logged-in `TestClient` (used by `test_chat.py`).

**Frontend — create:**
- `frontend/src/lib/nda-chat-client.ts` — typed `sendChatTurn(...)` wrapper around `fetch`.
- `frontend/src/lib/nda-chat-types.ts` — shared `ChatMessage`, `ChatRequest`, `ChatResponse` types.
- `frontend/src/lib/__tests__/nda-chat-client.test.ts`
- `frontend/src/components/nda-chat-app.tsx` — top-level component (owns chat + fields state, header, layout).
- `frontend/src/components/nda-chat.tsx` — left-column chat UI.
- `frontend/src/components/nda-edit-panel.tsx` — collapsible `<details>` wrapper around existing `NdaForm`.
- `frontend/src/components/__tests__/nda-chat-app.test.tsx`
- `frontend/src/components/__tests__/nda-edit-panel.test.tsx`
- `frontend/src/lib/__tests__/nda-schema-parity.test.ts` — TS↔Python schema drift check.
- `frontend/e2e/mutual-nda-chat.spec.ts` — happy-path Playwright spec with stubbed chat endpoint.

**Frontend — modify:**
- `frontend/src/app/dashboard/templates/mutual-nda/page.tsx` — swap `<NdaApp>` for `<NdaChatApp>`.

**Frontend — delete:**
- `frontend/src/components/nda-app.tsx` — unreferenced after the swap.

**Infra — modify:**
- `docker-compose.yml` — pass `OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}` to the backend service.
- `.gitignore` — already updated for `.superpowers/` in the spec commit.

---

## Task 1: Backend Pydantic `NdaData` mirror

**Files:**
- Create: `backend/src/prelegal_backend/nda_schema.py`
- Test:   `backend/tests/test_nda_schema.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_nda_schema.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_nda_schema.py -v`
Expected: collection error or ImportError — `nda_schema` module does not exist.

- [ ] **Step 3: Create the Pydantic models**

Create `backend/src/prelegal_backend/nda_schema.py`:

```python
"""Pydantic mirror of the TS NdaData shape in frontend/src/lib/nda-schema.ts.

Wire format is camelCase (to match the TS shape); Python attributes use
snake_case via Field aliases.
"""

from __future__ import annotations

from typing import Literal, Union

from pydantic import BaseModel, ConfigDict, Field


def _to_camel(s: str) -> str:
    head, *tail = s.split("_")
    return head + "".join(w.capitalize() for w in tail)


class _Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class Party(_Base):
    name: str
    title: str
    company: str
    notice_address: str
    date: str  # ISO yyyy-mm-dd


class _MndaTermYears(_Base):
    kind: Literal["years"]
    years: int = Field(ge=1)


class _MndaTermUntilTerminated(_Base):
    kind: Literal["untilTerminated"]


MndaTerm = Union[_MndaTermYears, _MndaTermUntilTerminated]


class _ConfTermYears(_Base):
    kind: Literal["years"]
    years: int = Field(ge=1)


class _ConfTermPerpetuity(_Base):
    kind: Literal["perpetuity"]


ConfidentialityTerm = Union[_ConfTermYears, _ConfTermPerpetuity]


class NdaData(_Base):
    purpose: str
    effective_date: str
    mnda_term: MndaTerm
    confidentiality_term: ConfidentialityTerm
    governing_law: str
    jurisdiction: str
    modifications: str
    party1: Party
    party2: Party
```

> **Note on `MndaTerm`/`ConfidentialityTerm`:** Pydantic resolves the
> discriminated union by trying each member. Because the `kind` literal differs
> between members, validation rejects unknown values like `"centuries"` with a
> `ValidationError`. `isinstance(value, MndaTerm)` returns `True` for either
> concrete subclass (Python `typing.Union` semantics).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_nda_schema.py -v`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/prelegal_backend/nda_schema.py backend/tests/test_nda_schema.py
git commit -m "PL-5: backend Pydantic mirror of NdaData with camelCase wire aliases"
```

---

## Task 2: Backend `PartialNdaData` + `deep_merge_fields`

The LLM returns only the fields it just learned. `PartialNdaData` is `NdaData` with every leaf optional. `deep_merge_fields(current, partial)` returns a new `NdaData` with partial fields applied.

**Files:**
- Modify: `backend/src/prelegal_backend/nda_schema.py`
- Modify: `backend/tests/test_nda_schema.py`

- [ ] **Step 1: Add the failing merge tests**

Append to `backend/tests/test_nda_schema.py`:

```python
from prelegal_backend.nda_schema import (
    PartialNdaData,
    deep_merge_fields,
)


def test_partial_nda_data_accepts_empty_object() -> None:
    p = PartialNdaData.model_validate({})
    assert p.governing_law is None
    assert p.party1 is None


def test_deep_merge_updates_only_provided_leaves() -> None:
    current = NdaData.model_validate(_sample_nda_data_wire())
    partial = PartialNdaData.model_validate(
        {"governingLaw": "California", "party1": {"company": "NewName Inc."}}
    )
    merged = deep_merge_fields(current, partial)
    assert merged.governing_law == "California"
    assert merged.party1.company == "NewName Inc."
    # untouched fields preserved
    assert merged.party1.name == "Ada Lovelace"
    assert merged.party2.company == "Globex Corp."
    assert merged.jurisdiction == "New Castle, DE"


def test_deep_merge_replaces_discriminated_union_atomically() -> None:
    current = NdaData.model_validate(_sample_nda_data_wire())
    # switching from "years" to "untilTerminated" should drop the years field
    partial = PartialNdaData.model_validate(
        {"mndaTerm": {"kind": "untilTerminated"}}
    )
    merged = deep_merge_fields(current, partial)
    assert merged.mnda_term.kind == "untilTerminated"
    assert not hasattr(merged.mnda_term, "years")


def test_deep_merge_returns_same_data_when_partial_is_empty() -> None:
    current = NdaData.model_validate(_sample_nda_data_wire())
    merged = deep_merge_fields(current, PartialNdaData())
    assert merged.model_dump() == current.model_dump()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_nda_schema.py -v`
Expected: ImportError on `PartialNdaData` or `deep_merge_fields`.

- [ ] **Step 3: Add `PartialNdaData` and `deep_merge_fields`**

Append to `backend/src/prelegal_backend/nda_schema.py`:

```python
class PartialParty(_Base):
    name: str | None = None
    title: str | None = None
    company: str | None = None
    notice_address: str | None = None
    date: str | None = None


class PartialNdaData(_Base):
    purpose: str | None = None
    effective_date: str | None = None
    # Term fields use the same discriminated-union types as NdaData. When the
    # LLM wants to update a term, it must send a complete, valid term object;
    # we do not allow partial term updates (would be ambiguous which kind).
    mnda_term: MndaTerm | None = None
    confidentiality_term: ConfidentialityTerm | None = None
    governing_law: str | None = None
    jurisdiction: str | None = None
    modifications: str | None = None
    party1: PartialParty | None = None
    party2: PartialParty | None = None


def deep_merge_fields(current: NdaData, partial: PartialNdaData) -> NdaData:
    """Return a new NdaData with every non-None leaf in `partial` applied to
    `current`. Term unions are replaced atomically (not merged)."""

    merged = current.model_dump(by_alias=False)

    def _apply_party(target: dict, src: PartialParty | None) -> None:
        if src is None:
            return
        for field_name, value in src.model_dump(by_alias=False, exclude_none=True).items():
            target[field_name] = value

    if partial.purpose is not None:
        merged["purpose"] = partial.purpose
    if partial.effective_date is not None:
        merged["effective_date"] = partial.effective_date
    if partial.mnda_term is not None:
        merged["mnda_term"] = partial.mnda_term.model_dump(by_alias=False)
    if partial.confidentiality_term is not None:
        merged["confidentiality_term"] = partial.confidentiality_term.model_dump(by_alias=False)
    if partial.governing_law is not None:
        merged["governing_law"] = partial.governing_law
    if partial.jurisdiction is not None:
        merged["jurisdiction"] = partial.jurisdiction
    if partial.modifications is not None:
        merged["modifications"] = partial.modifications
    _apply_party(merged["party1"], partial.party1)
    _apply_party(merged["party2"], partial.party2)

    return NdaData.model_validate(merged)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_nda_schema.py -v`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/prelegal_backend/nda_schema.py backend/tests/test_nda_schema.py
git commit -m "PL-5: PartialNdaData + deep_merge_fields helper"
```

---

## Task 3: Backend `handle_turn` — happy path (TDD with mocked LiteLLM)

**Files:**
- Create: `backend/src/prelegal_backend/chat.py`
- Create: `backend/tests/test_chat.py`

- [ ] **Step 1: Write the failing happy-path test**

Create `backend/tests/test_chat.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_chat.py::test_handle_turn_merges_updated_fields -v`
Expected: ImportError on `prelegal_backend.chat`.

- [ ] **Step 3: Create the minimal `chat` module to make this pass**

Create `backend/src/prelegal_backend/chat.py`:

```python
"""POST /api/templates/mutual-nda/chat — one Structured-Outputs round-trip per turn."""

from __future__ import annotations

import json
import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from litellm import completion
from pydantic import BaseModel, ConfigDict, ValidationError

from .auth import current_user
from .nda_schema import NdaData, PartialNdaData, deep_merge_fields
from .users import User

logger = logging.getLogger(__name__)

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
MAX_HISTORY = 60  # user/assistant messages forwarded to the model


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatTurn(BaseModel):
    """Structured-Outputs schema the model must return per turn."""

    model_config = ConfigDict(extra="forbid")

    assistant_message: str
    updated_fields: PartialNdaData
    is_complete: bool


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    current_fields: NdaData


class ChatResponse(BaseModel):
    assistant_message: str
    merged_fields: NdaData
    is_complete: bool


def _build_system_prompt(current_fields: NdaData) -> str:
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


def handle_turn(messages: list[ChatMessage], current_fields: NdaData) -> ChatResponse:
    bounded = messages[-MAX_HISTORY:]
    llm_messages = [{"role": "system", "content": _build_system_prompt(current_fields)}]
    llm_messages.extend({"role": m.role, "content": m.content} for m in bounded)

    try:
        response = completion(
            model=MODEL,
            messages=llm_messages,
            response_format=ChatTurn,
            reasoning_effort="low",
            extra_body=EXTRA_BODY,
        )
    except Exception:
        logger.exception("LiteLLM completion failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service unavailable",
        )

    content = response.choices[0].message.content
    try:
        turn = ChatTurn.model_validate_json(content)
    except ValidationError:
        logger.exception("Model returned malformed ChatTurn JSON: %s", content)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI returned an invalid response",
        )

    if not turn.assistant_message.strip():
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI returned an empty message",
        )

    merged = deep_merge_fields(current_fields, turn.updated_fields)
    return ChatResponse(
        assistant_message=turn.assistant_message,
        merged_fields=merged,
        is_complete=turn.is_complete,
    )


router = APIRouter(prefix="/api/templates/mutual-nda", tags=["mutual-nda-chat"])


@router.post("/chat", response_model=ChatResponse)
def chat(
    body: ChatRequest,
    _: Annotated[User, Depends(current_user)],
) -> ChatResponse:
    return handle_turn(body.messages, body.current_fields)
```

> **Why `from litellm import completion` at the top:** the test monkeypatches
> `chat_module.completion`, which only works if `completion` is a module-level
> name. If you `import litellm` and call `litellm.completion(...)`, the
> monkeypatch won't take.

- [ ] **Step 4: Add `litellm` to the backend deps so the import resolves**

Run: `cd backend && uv add litellm`
Expected: `pyproject.toml` and `uv.lock` updated; success message.

- [ ] **Step 5: Run the happy-path test to verify it passes**

Run: `cd backend && uv run pytest tests/test_chat.py::test_handle_turn_merges_updated_fields -v`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/prelegal_backend/chat.py backend/tests/test_chat.py backend/pyproject.toml backend/uv.lock
git commit -m "PL-5: backend chat module with handle_turn happy path (mocked LiteLLM)"
```

---

## Task 4: Backend `handle_turn` — error paths

**Files:**
- Modify: `backend/tests/test_chat.py` (append)

- [ ] **Step 1: Append failing error-path tests**

Append to `backend/tests/test_chat.py`:

```python
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
```

- [ ] **Step 2: Run new tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_chat.py -v`
Expected: 4 passed (1 from Task 3 + 3 new).

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_chat.py
git commit -m "PL-5: chat handle_turn error-path tests (empty msg, LLM error, malformed JSON)"
```

---

## Task 5: Backend `handle_turn` — bounded history

**Files:**
- Modify: `backend/tests/test_chat.py` (append)

- [ ] **Step 1: Append failing bounded-history test**

Append to `backend/tests/test_chat.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_chat.py::test_handle_turn_caps_history_at_60 -v`
Expected: 1 passed.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_chat.py
git commit -m "PL-5: assert handle_turn caps history at MAX_HISTORY (60) messages"
```

---

## Task 6: Backend — wire `chat.router`, add `auth_client` fixture, test endpoint auth gating

**Files:**
- Modify: `backend/src/prelegal_backend/main.py`
- Modify: `backend/tests/conftest.py`
- Modify: `backend/tests/test_chat.py` (append)

- [ ] **Step 1: Add the `auth_client` fixture to conftest**

Modify `backend/tests/conftest.py` — append after the existing `client` fixture:

```python
@pytest.fixture
def auth_client(client: TestClient) -> TestClient:
    """A TestClient that has already signed in via fake-auth."""
    response = client.post(
        "/api/auth/login",
        json={"email": "chat-tester@example.com", "name": "Chat Tester"},
    )
    assert response.status_code == 200, response.text
    return client
```

- [ ] **Step 2: Add the failing endpoint tests**

Append to `backend/tests/test_chat.py`:

```python
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_chat.py -v`
Expected: the 3 new endpoint tests fail with 404 (route not registered).

- [ ] **Step 4: Make `ChatResponse` serialize with camelCase aliases on the wire**

The endpoint test asserts the response body has `assistantMessage` and
`mergedFields` (camelCase). FastAPI uses the response model's field aliases
when `response_model_by_alias=True`. Add an alias generator to `ChatResponse`.

Modify `backend/src/prelegal_backend/chat.py` — replace the `ChatResponse`
class with this version and add the helper at the top of the file if not
already present:

```python
def _to_camel(s: str) -> str:
    head, *tail = s.split("_")
    return head + "".join(w.capitalize() for w in tail)


class ChatResponse(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
    )

    assistant_message: str
    merged_fields: NdaData
    is_complete: bool
```

And update the `@router.post` decorator to serialize by alias:

```python
@router.post("/chat", response_model=ChatResponse, response_model_by_alias=True)
def chat(
    body: ChatRequest,
    _: Annotated[User, Depends(current_user)],
) -> ChatResponse:
    return handle_turn(body.messages, body.current_fields)
```

- [ ] **Step 5: Wire `chat.router` into the app**

Modify `backend/src/prelegal_backend/main.py`:

```python
from . import auth, chat, db, templates
```

And inside `create_app()`, alongside the existing `include_router` calls:

```python
    app.include_router(chat.router)
```

- [ ] **Step 6: Run all chat tests to verify they pass**

Run: `cd backend && uv run pytest tests/ -v`
Expected: all tests pass (existing + new).

- [ ] **Step 7: Commit**

```bash
git add backend/src/prelegal_backend/main.py backend/src/prelegal_backend/chat.py \
        backend/tests/conftest.py backend/tests/test_chat.py
git commit -m "PL-5: wire /api/templates/mutual-nda/chat endpoint with auth gating"
```

---

## Task 7: Frontend chat types + client (TDD)

**Files:**
- Create: `frontend/src/lib/nda-chat-types.ts`
- Create: `frontend/src/lib/nda-chat-client.ts`
- Create: `frontend/src/lib/__tests__/nda-chat-client.test.ts`

- [ ] **Step 1: Write the failing client test**

Create `frontend/src/lib/__tests__/nda-chat-client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendChatTurn, ChatError } from "@/lib/nda-chat-client";
import type { ChatMessage } from "@/lib/nda-chat-types";
import { defaultNdaData } from "@/lib/nda-schema";

describe("sendChatTurn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs to the chat endpoint with messages + current fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          assistantMessage: "Got it.",
          mergedFields: defaultNdaData(),
          isComplete: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const messages: ChatMessage[] = [
      { role: "assistant", content: "Hi" },
      { role: "user", content: "Acme" },
    ];
    const result = await sendChatTurn(messages, defaultNdaData());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/templates/mutual-nda/chat");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(init.body)).toEqual({
      messages,
      current_fields: defaultNdaData(),
    });
    expect(result.assistantMessage).toBe("Got it.");
    expect(result.isComplete).toBe(false);
  });

  it("throws a typed ChatError on non-2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "AI service unavailable" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendChatTurn([{ role: "user", content: "hi" }], defaultNdaData()),
    ).rejects.toMatchObject({
      name: "ChatError",
      status: 502,
      detail: "AI service unavailable",
    });
    await expect(
      sendChatTurn([{ role: "user", content: "hi" }], defaultNdaData()),
    ).rejects.toBeInstanceOf(ChatError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/lib/__tests__/nda-chat-client.test.ts`
Expected: import error on `@/lib/nda-chat-client`.

- [ ] **Step 3: Create the types module**

Create `frontend/src/lib/nda-chat-types.ts`:

```ts
import type { NdaData } from "./nda-schema";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  messages: ChatMessage[];
  current_fields: NdaData;
};

export type ChatResponse = {
  assistantMessage: string;
  mergedFields: NdaData;
  isComplete: boolean;
};
```

- [ ] **Step 4: Create the client**

Create `frontend/src/lib/nda-chat-client.ts`:

```ts
import type {
  ChatMessage,
  ChatResponse,
} from "./nda-chat-types";
import type { NdaData } from "./nda-schema";

export class ChatError extends Error {
  readonly name = "ChatError";
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`Chat request failed (${status}): ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

export async function sendChatTurn(
  messages: ChatMessage[],
  currentFields: NdaData,
): Promise<ChatResponse> {
  const response = await fetch("/api/templates/mutual-nda/chat", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, current_fields: currentFields }),
  });

  if (!response.ok) {
    let detail = response.statusText || "Request failed";
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // fall through with statusText
    }
    throw new ChatError(response.status, detail);
  }

  return (await response.json()) as ChatResponse;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npm test -- src/lib/__tests__/nda-chat-client.test.ts`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/nda-chat-types.ts frontend/src/lib/nda-chat-client.ts \
        frontend/src/lib/__tests__/nda-chat-client.test.ts
git commit -m "PL-5: frontend chat types + sendChatTurn client with ChatError"
```

---

## Task 8: Frontend `NdaChat` component (chat UI) — TDD

**Files:**
- Create: `frontend/src/components/nda-chat.tsx`
- Create: `frontend/src/components/__tests__/nda-chat.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/__tests__/nda-chat.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NdaChat } from "@/components/nda-chat";
import type { ChatMessage } from "@/lib/nda-chat-types";

const messages: ChatMessage[] = [
  { role: "assistant", content: "Hi — who are the parties?" },
];

describe("NdaChat", () => {
  it("renders messages and disables send while sending", () => {
    render(
      <NdaChat
        messages={messages}
        status="sending"
        errorMessage={null}
        onSend={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByText("Hi — who are the parties?")).toBeDefined();
    const button = screen.getByRole("button", { name: /send/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(/sending/i)).toBeDefined();
  });

  it("calls onSend with trimmed text when the user submits", () => {
    const onSend = vi.fn();
    render(
      <NdaChat
        messages={messages}
        status="idle"
        errorMessage={null}
        onSend={onSend}
        onReset={vi.fn()}
      />,
    );
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "  Acme Inc.  " } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onSend).toHaveBeenCalledWith("Acme Inc.");
  });

  it("disables send when textarea is empty after trim", () => {
    render(
      <NdaChat
        messages={messages}
        status="idle"
        errorMessage={null}
        onSend={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    const button = screen.getByRole("button", { name: /send/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    expect(button.disabled).toBe(true);
  });

  it("shows the retry banner on error and re-sends the last user message on click", () => {
    const onSend = vi.fn();
    render(
      <NdaChat
        messages={[
          ...messages,
          { role: "user", content: "Acme Inc." },
        ]}
        status="error"
        errorMessage="AI service unavailable"
        onSend={onSend}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByText(/AI service unavailable/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onSend).toHaveBeenCalledWith("Acme Inc.");
  });

  it("Start over invokes onReset", () => {
    const onReset = vi.fn();
    render(
      <NdaChat
        messages={messages}
        status="idle"
        errorMessage={null}
        onSend={vi.fn()}
        onReset={onReset}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /start over/i }));
    expect(onReset).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- src/components/__tests__/nda-chat.test.tsx`
Expected: import error on `@/components/nda-chat`.

- [ ] **Step 3: Create the component**

Create `frontend/src/components/nda-chat.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/nda-chat-types";

export type ChatStatus = "idle" | "sending" | "error";

type Props = {
  messages: ChatMessage[];
  status: ChatStatus;
  errorMessage: string | null;
  onSend: (content: string) => void;
  onReset: () => void;
};

export function NdaChat({
  messages,
  status,
  errorMessage,
  onSend,
  onReset,
}: Props) {
  const [draft, setDraft] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, status]);

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0 && status !== "sending";

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed);
    setDraft("");
  };

  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  return (
    <div className="flex h-[640px] flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-brand-navy">Chat</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-brand-gray hover:text-brand-navy"
        >
          Start over
        </button>
      </header>

      <div
        ref={threadRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
        data-testid="chat-thread"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-md px-3 py-2 text-sm",
              m.role === "assistant"
                ? "bg-blue-50 text-slate-900"
                : "bg-slate-100 text-slate-900 ml-auto",
            )}
          >
            {m.content}
          </div>
        ))}
        {status === "sending" ? (
          <p className="text-xs italic text-brand-gray">Sending…</p>
        ) : null}
      </div>

      {status === "error" && errorMessage ? (
        <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          <span>{errorMessage}</span>
          {lastUser ? (
            <button
              type="button"
              onClick={() => onSend(lastUser.content)}
              className="ml-2 underline"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="border-t border-slate-200 p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder="Type a message…"
          className="block w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={!canSend}
            onClick={submit}
            className="inline-flex items-center gap-2 rounded-md bg-brand-purple px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-purple/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- src/components/__tests__/nda-chat.test.tsx`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/nda-chat.tsx \
        frontend/src/components/__tests__/nda-chat.test.tsx
git commit -m "PL-5: NdaChat presentational component with retry + start-over"
```

---

## Task 9: Frontend `NdaEditPanel` component — TDD

**Files:**
- Create: `frontend/src/components/nda-edit-panel.tsx`
- Create: `frontend/src/components/__tests__/nda-edit-panel.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/__tests__/nda-edit-panel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NdaEditPanel } from "@/components/nda-edit-panel";
import { defaultNdaData } from "@/lib/nda-schema";

describe("NdaEditPanel", () => {
  it("is collapsed by default and reveals the form when opened", () => {
    render(
      <NdaEditPanel value={defaultNdaData()} onChange={vi.fn()} />,
    );
    // <details> starts closed → no form fields rendered yet
    expect(screen.queryByLabelText("Purpose")).toBeNull();

    fireEvent.click(screen.getByText(/edit fields manually/i));
    expect(screen.getByLabelText("Purpose")).toBeDefined();
  });

  it("forwards form edits via onChange", () => {
    const onChange = vi.fn();
    render(
      <NdaEditPanel value={defaultNdaData()} onChange={onChange} />,
    );
    fireEvent.click(screen.getByText(/edit fields manually/i));
    fireEvent.change(screen.getByLabelText("Purpose"), {
      target: { value: "new purpose" },
    });
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.purpose).toBe("new purpose");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- src/components/__tests__/nda-edit-panel.test.tsx`
Expected: import error on `@/components/nda-edit-panel`.

- [ ] **Step 3: Create the component**

Create `frontend/src/components/nda-edit-panel.tsx`:

```tsx
"use client";

import { NdaForm } from "./nda-form";
import type { NdaData } from "@/lib/nda-schema";

type Props = {
  value: NdaData;
  onChange: (next: NdaData) => void;
};

export function NdaEditPanel({ value, onChange }: Props) {
  return (
    <details className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-brand-navy hover:bg-slate-50">
        Edit fields manually
      </summary>
      <div className="border-t border-slate-200 p-6">
        <NdaForm value={value} onChange={onChange} />
      </div>
    </details>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- src/components/__tests__/nda-edit-panel.test.tsx`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/nda-edit-panel.tsx \
        frontend/src/components/__tests__/nda-edit-panel.test.tsx
git commit -m "PL-5: NdaEditPanel — collapsible NdaForm wrapper"
```

---

## Task 10: Frontend `NdaChatApp` (top-level component) — TDD

This component owns state, wires the chat client, includes the preview + edit panel, and reuses the PDF-download wiring lifted from `nda-app.tsx`.

**Files:**
- Create: `frontend/src/components/nda-chat-app.tsx`
- Create: `frontend/src/components/__tests__/nda-chat-app.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/__tests__/nda-chat-app.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { NdaChatApp } from "@/components/nda-chat-app";
import { defaultNdaData } from "@/lib/nda-schema";
import * as chatClient from "@/lib/nda-chat-client";

const STANDARD_TERMS = "# Standard Terms\n\nDummy.";
const STANDARD_TERMS_BLOCKS = [{ kind: "p", text: "Dummy." } as any];

describe("NdaChatApp", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the initial assistant greeting on mount", () => {
    render(
      <NdaChatApp
        standardTerms={STANDARD_TERMS}
        standardTermsBlocks={STANDARD_TERMS_BLOCKS}
      />,
    );
    expect(
      screen.getByText(/Hi — I'll help you draft a Common Paper Mutual NDA/),
    ).toBeDefined();
  });

  it("sends a chat turn, appends the assistant reply, and updates the preview", async () => {
    const next = defaultNdaData();
    next.party1.company = "Acme Inc.";
    const spy = vi
      .spyOn(chatClient, "sendChatTurn")
      .mockResolvedValue({
        assistantMessage: "Got it. What state should govern?",
        mergedFields: next,
        isComplete: false,
      });

    render(
      <NdaChatApp
        standardTerms={STANDARD_TERMS}
        standardTermsBlocks={STANDARD_TERMS_BLOCKS}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Acme Inc. and Globex Corp." },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });
    expect(
      await screen.findByText("Got it. What state should govern?"),
    ).toBeDefined();
    // Preview shows the merged field value
    expect(screen.getAllByText("Acme Inc.").length).toBeGreaterThan(0);
  });

  it("shows the retry banner when sendChatTurn rejects", async () => {
    vi.spyOn(chatClient, "sendChatTurn").mockRejectedValue(
      new chatClient.ChatError(502, "AI service unavailable"),
    );

    render(
      <NdaChatApp
        standardTerms={STANDARD_TERMS}
        standardTermsBlocks={STANDARD_TERMS_BLOCKS}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "hi" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText(/AI service unavailable/)).toBeDefined();
    expect(screen.getByRole("button", { name: /retry/i })).toBeDefined();
  });

  it("Start over resets messages back to the greeting and fields to defaults", async () => {
    const next = defaultNdaData();
    next.party1.company = "Acme Inc.";
    vi.spyOn(chatClient, "sendChatTurn").mockResolvedValue({
      assistantMessage: "ok",
      mergedFields: next,
      isComplete: false,
    });

    render(
      <NdaChatApp
        standardTerms={STANDARD_TERMS}
        standardTermsBlocks={STANDARD_TERMS_BLOCKS}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await screen.findByText("ok");

    fireEvent.click(screen.getByRole("button", { name: /start over/i }));
    // Only the greeting should remain in the thread.
    expect(
      screen.getByText(/Hi — I'll help you draft a Common Paper Mutual NDA/),
    ).toBeDefined();
    expect(screen.queryByText("ok")).toBeNull();
    expect(screen.queryByText("Acme")).toBeNull();
  });

  it("shows a Ready chip and keeps Download enabled when is_complete arrives", async () => {
    vi.spyOn(chatClient, "sendChatTurn").mockResolvedValue({
      assistantMessage: "All set!",
      mergedFields: defaultNdaData(),
      isComplete: true,
    });

    render(
      <NdaChatApp
        standardTerms={STANDARD_TERMS}
        standardTermsBlocks={STANDARD_TERMS_BLOCKS}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "done" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText(/Ready to download/i)).toBeDefined();
    const download = screen.getByTestId("download-pdf") as HTMLButtonElement;
    expect(download.disabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- src/components/__tests__/nda-chat-app.test.tsx`
Expected: import error on `@/components/nda-chat-app`.

- [ ] **Step 3: Create the component**

Create `frontend/src/components/nda-chat-app.tsx`:

```tsx
"use client";

import { useCallback, useState } from "react";
import { NdaChat, type ChatStatus } from "./nda-chat";
import { NdaPreview } from "./nda-preview";
import { NdaEditPanel } from "./nda-edit-panel";
import type { Block } from "@/lib/markdown-blocks";
import { defaultNdaData, type NdaData } from "@/lib/nda-schema";
import type { ChatMessage } from "@/lib/nda-chat-types";
import { sendChatTurn, ChatError } from "@/lib/nda-chat-client";

type Props = {
  standardTerms: string;
  standardTermsBlocks: Block[];
};

type DownloadStatus = "idle" | "generating" | "error";

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi — I'll help you draft a Common Paper Mutual NDA. To start: what are the names of the two companies entering this agreement?",
};

const MAX_MESSAGES = 60;

const buildPdfFileName = (data: NdaData): string => {
  const slug = (s: string) =>
    s.trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const parts = [slug(data.party1.company), slug(data.party2.company)].filter(Boolean);
  return parts.length > 0
    ? `Mutual-NDA-${parts.join("-")}.pdf`
    : "Mutual-NDA.pdf";
};

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const capMessages = (msgs: ChatMessage[]): ChatMessage[] =>
  msgs.length <= MAX_MESSAGES ? msgs : msgs.slice(msgs.length - MAX_MESSAGES);

export function NdaChatApp({ standardTerms, standardTermsBlocks }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [fields, setFields] = useState<NdaData>(defaultNdaData);
  const [chatStatus, setChatStatus] = useState<ChatStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>("idle");

  const handleSend = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = { role: "user", content };
      const nextMessages = capMessages([...messages, userMessage]);
      setMessages(nextMessages);
      setChatStatus("sending");
      setErrorMessage(null);
      try {
        const result = await sendChatTurn(nextMessages, fields);
        setMessages(
          capMessages([
            ...nextMessages,
            { role: "assistant", content: result.assistantMessage },
          ]),
        );
        setFields(result.mergedFields);
        setIsComplete(result.isComplete);
        setChatStatus("idle");
      } catch (err) {
        const detail =
          err instanceof ChatError ? err.detail : "Couldn't reach the AI.";
        setErrorMessage(detail);
        setChatStatus("error");
      }
    },
    [messages, fields],
  );

  const handleReset = useCallback(() => {
    setMessages([GREETING]);
    setFields(defaultNdaData());
    setChatStatus("idle");
    setErrorMessage(null);
    setIsComplete(false);
  }, []);

  const handleDownload = useCallback(async () => {
    setDownloadStatus("generating");
    try {
      const [{ pdf }, { NdaPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/nda-pdf-document"),
      ]);
      const blob = await pdf(
        <NdaPdfDocument
          data={fields}
          standardTermsBlocks={standardTermsBlocks}
        />,
      ).toBlob();
      triggerBlobDownload(blob, buildPdfFileName(fields));
      setDownloadStatus("idle");
    } catch (err) {
      console.error("Failed to generate NDA PDF", err);
      setDownloadStatus("error");
    }
  }, [fields, standardTermsBlocks]);

  return (
    <div className="space-y-8">
      <header className="no-print flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-navy">
            Mutual NDA Creator
          </h1>
          <p className="mt-1 text-sm text-brand-gray">
            Tell the assistant about your agreement — the preview fills in as you chat.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <div className="flex items-center gap-3">
            {isComplete ? (
              <span className="text-xs font-medium text-emerald-700">
                ✓ Ready to download
              </span>
            ) : null}
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloadStatus === "generating"}
              data-testid="download-pdf"
              className="inline-flex items-center gap-2 rounded-md bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:bg-brand-purple/90 focus:outline-none focus:ring-2 focus:ring-brand-purple/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloadStatus === "generating" ? "Generating…" : "Download PDF"}
            </button>
          </div>
          {downloadStatus === "error" ? (
            <p className="text-xs text-red-600" role="alert">
              Could not generate the PDF. Check the console and try again.
            </p>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <section className="no-print">
          <NdaChat
            messages={messages}
            status={chatStatus}
            errorMessage={errorMessage}
            onSend={handleSend}
            onReset={handleReset}
          />
        </section>
        <section>
          <NdaPreview value={fields} standardTerms={standardTerms} />
        </section>
      </div>

      <section className="no-print">
        <NdaEditPanel value={fields} onChange={setFields} />
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- src/components/__tests__/nda-chat-app.test.tsx`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/nda-chat-app.tsx \
        frontend/src/components/__tests__/nda-chat-app.test.tsx
git commit -m "PL-5: NdaChatApp wires chat ↔ preview ↔ edit panel ↔ PDF download"
```

---

## Task 11: Swap the route to `NdaChatApp`, delete the old `NdaApp`

**Files:**
- Modify: `frontend/src/app/dashboard/templates/mutual-nda/page.tsx`
- Delete: `frontend/src/components/nda-app.tsx`

- [ ] **Step 1: Replace `NdaApp` with `NdaChatApp` on the route**

Replace the entire contents of
`frontend/src/app/dashboard/templates/mutual-nda/page.tsx` with:

```tsx
import { NdaChatApp } from "@/components/nda-chat-app";
import {
  loadStandardTerms,
  loadStandardTermsBlocks,
} from "@/lib/templates";

export const metadata = {
  title: "Mutual NDA Creator · Prelegal",
};

export default async function MutualNdaPage() {
  const standardTerms = loadStandardTerms();
  const standardTermsBlocks = loadStandardTermsBlocks();
  return (
    <NdaChatApp
      standardTerms={standardTerms}
      standardTermsBlocks={standardTermsBlocks}
    />
  );
}
```

- [ ] **Step 2: Delete the unreferenced `nda-app.tsx`**

Run: `rm frontend/src/components/nda-app.tsx`

- [ ] **Step 3: Verify no stale references remain**

Run: `cd frontend && grep -RIn "nda-app" src e2e || echo "no references"`
Expected: `no references`.

- [ ] **Step 4: Type-check + lint**

Run: `cd frontend && npx tsc --noEmit && npm run lint`
Expected: both pass with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/templates/mutual-nda/page.tsx
git add -u frontend/src/components/nda-app.tsx
git commit -m "PL-5: swap Mutual NDA route to NdaChatApp; delete unused NdaApp"
```

---

## Task 12: Schema parity test (TS ↔ Python)

Catch silent drift between `frontend/src/lib/nda-schema.ts` and
`backend/src/prelegal_backend/nda_schema.py`. We commit a JSON fixture that
both sides validate against.

**Files:**
- Create: `frontend/src/lib/__tests__/nda-schema-parity.fixture.json`
- Create: `frontend/src/lib/__tests__/nda-schema-parity.test.ts`
- Create: `backend/tests/test_schema_parity.py`

- [ ] **Step 1: Create the shared fixture**

Create `frontend/src/lib/__tests__/nda-schema-parity.fixture.json`:

```json
{
  "purpose": "Evaluating a deal.",
  "effectiveDate": "2026-05-23",
  "mndaTerm": { "kind": "years", "years": 2 },
  "confidentialityTerm": { "kind": "perpetuity" },
  "governingLaw": "Delaware",
  "jurisdiction": "New Castle, DE",
  "modifications": "",
  "party1": {
    "name": "Ada Lovelace",
    "title": "CEO",
    "company": "Acme Inc.",
    "noticeAddress": "1 Main St",
    "date": "2026-05-23"
  },
  "party2": {
    "name": "Grace Hopper",
    "title": "CTO",
    "company": "Globex Corp.",
    "noticeAddress": "ada@globex.com",
    "date": "2026-05-23"
  }
}
```

- [ ] **Step 2: Frontend parity test — validates the fixture is shaped like `NdaData`**

Create `frontend/src/lib/__tests__/nda-schema-parity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import fixture from "./nda-schema-parity.fixture.json";
import type { NdaData } from "@/lib/nda-schema";

describe("NdaData ↔ fixture parity", () => {
  it("the fixture is assignable to NdaData", () => {
    // Compile-time check; if this stops compiling, the TS shape drifted.
    const data: NdaData = fixture as NdaData;
    expect(data.governingLaw).toBe("Delaware");
    expect(data.party1.noticeAddress).toBe("1 Main St");
    expect(data.mndaTerm.kind).toBe("years");
    expect(data.confidentialityTerm.kind).toBe("perpetuity");
  });
});
```

- [ ] **Step 3: Backend parity test — loads the same fixture file**

Create `backend/tests/test_schema_parity.py`:

```python
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
```

> **Note:** If the test directory layout changes, update `parents[2]` —
> currently `tests/` → `backend/` → repo root.

- [ ] **Step 4: Run both parity tests**

Run: `cd frontend && npm test -- src/lib/__tests__/nda-schema-parity.test.ts`
Expected: 1 passed.

Run: `cd backend && uv run pytest tests/test_schema_parity.py -v`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/__tests__/nda-schema-parity.fixture.json \
        frontend/src/lib/__tests__/nda-schema-parity.test.ts \
        backend/tests/test_schema_parity.py
git commit -m "PL-5: TS ↔ Python schema parity test with shared fixture"
```

---

## Task 13: Docker wiring — pass `OPENROUTER_API_KEY` to backend container

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Confirm baseline state of the file**

Run: `git diff -- docker-compose.yml`
Expected: shows any prior unrelated edits (these were present before PL-5 — leave them alone if benign; otherwise back them out into a separate branch before continuing).

- [ ] **Step 2: Add the env var passthrough**

In `docker-compose.yml`, under `services.backend.environment`, add a new
line **alongside** the existing `PRELEGAL_*` entries:

```yaml
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
```

> The repo `.env` already has `OPENROUTER_API_KEY`; Docker Compose auto-loads
> repo-root `.env`, so no extra wiring is needed beyond this line.

- [ ] **Step 3: Verify Compose accepts the file**

Run: `docker compose config --services`
Expected: prints `backend` and `frontend` with no error.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "PL-5: pass OPENROUTER_API_KEY to backend container"
```

---

## Task 14: E2E happy-path Playwright spec

**Files:**
- Create: `frontend/e2e/mutual-nda-chat.spec.ts`

- [ ] **Step 1: Inspect the existing login + download-pdf specs for the auth pattern**

Run: `cat frontend/e2e/login-dashboard.spec.ts frontend/e2e/download-pdf.spec.ts`
Note the existing helpers / login flow so the new spec follows the same shape (do NOT invent a different one).

- [ ] **Step 2: Write the new spec**

Create `frontend/e2e/mutual-nda-chat.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("mutual NDA chat — happy path, preview updates, PDF downloads", async ({ page }) => {
  // 1. Stub the chat endpoint with a canned sequence of responses.
  let turn = 0;
  const merged = {
    purpose: "Evaluating a deal.",
    effectiveDate: "2026-05-23",
    mndaTerm: { kind: "years", years: 1 },
    confidentialityTerm: { kind: "years", years: 1 },
    governingLaw: "Delaware",
    jurisdiction: "New Castle, DE",
    modifications: "",
    party1: { name: "Ada", title: "CEO", company: "Acme Inc.", noticeAddress: "1 Main St", date: "2026-05-23" },
    party2: { name: "Grace", title: "CTO", company: "Globex Corp.", noticeAddress: "g@g.co", date: "2026-05-23" },
  };

  await page.route("**/api/templates/mutual-nda/chat", async (route) => {
    turn += 1;
    const body =
      turn === 1
        ? {
            assistantMessage: "Got it — what state governs?",
            mergedFields: { ...merged, governingLaw: "", jurisdiction: "" },
            isComplete: false,
          }
        : turn === 2
        ? {
            assistantMessage: "Great. What city is jurisdiction in?",
            mergedFields: { ...merged, jurisdiction: "" },
            isComplete: false,
          }
        : {
            assistantMessage: "All set!",
            mergedFields: merged,
            isComplete: true,
          };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  // 2. Log in via fake-auth and navigate.
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("ada@example.com");
  await page.getByLabel(/name/i).fill("Ada");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("/dashboard/templates/mutual-nda");

  // 3. Run three turns; preview updates after the first.
  await expect(page.getByText(/Hi — I'll help you draft a Common Paper Mutual NDA/)).toBeVisible();

  await page.getByRole("textbox").fill("Acme Inc. and Globex Corp.");
  await page.getByRole("button", { name: /send/i }).click();
  await expect(page.getByText("Got it — what state governs?")).toBeVisible();
  // Preview now contains "Acme Inc." somewhere in the document.
  await expect(page.getByText("Acme Inc.").first()).toBeVisible();

  await page.getByRole("textbox").fill("Delaware");
  await page.getByRole("button", { name: /send/i }).click();
  await expect(page.getByText("Great. What city is jurisdiction in?")).toBeVisible();

  await page.getByRole("textbox").fill("New Castle, DE");
  await page.getByRole("button", { name: /send/i }).click();
  await expect(page.getByText("All set!")).toBeVisible();
  await expect(page.getByText(/Ready to download/i)).toBeVisible();

  // 4. Toggle the edit panel and assert the form is reachable.
  await page.getByText(/edit fields manually/i).click();
  await expect(page.getByLabel("Purpose")).toBeVisible();

  // 5. Click Download PDF and verify a download event fires.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("download-pdf").click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^Mutual-NDA-Acme-Inc-Globex-Corp\.pdf$/);
});
```

- [ ] **Step 3: Run the new spec**

Run: `cd frontend && npm run test:e2e -- mutual-nda-chat.spec.ts`
Expected: 1 passed. (If a login element selector doesn't match, adjust per the existing `login-dashboard.spec.ts`.)

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e/mutual-nda-chat.spec.ts
git commit -m "PL-5: E2E happy path — stubbed chat endpoint, preview updates, PDF download"
```

---

## Task 15: Full-suite gate + manual smoke

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && uv run pytest -v`
Expected: all green.

- [ ] **Step 2: Run all frontend unit tests**

Run: `cd frontend && npm test`
Expected: all green.

- [ ] **Step 3: Run all E2E tests**

Run: `cd frontend && npm run test:e2e`
Expected: all green.

- [ ] **Step 4: Manual smoke against a real LLM**

```bash
# Bring up Docker with the real OPENROUTER_API_KEY in repo .env
docker compose up --build -d
# Watch backend logs in another shell:
docker compose logs -f backend
```

In the browser at <http://localhost:3000>:

1. Sign in via fake-auth (any email + name).
2. Open the Mutual NDA card → `/dashboard/templates/mutual-nda`.
3. Run a real conversation start-to-finish (parties → purpose → terms →
   governing law → jurisdiction → modifications → signers → dates).
4. Confirm the preview fills in as you chat.
5. Click "Edit fields manually" — change one field — confirm preview updates
   and the AI doesn't re-ask for it on the next turn.
6. Click "Download PDF" — verify the filename matches and the PDF opens.
7. Grep logs: `docker compose logs backend | grep -i openrouter_api_key`
   Expected: zero matches.

Tear down: `docker compose down`.

- [ ] **Step 5: No commit — this step is verification only.**

---

## Task 16: Open the PR

- [ ] **Step 1: Push the branch**

Run: `git push -u origin PL-5`

- [ ] **Step 2: Open the PR via `gh`**

```bash
gh pr create --title "PL-5: AI chat for Mutual NDA" --body "$(cat <<'EOF'
## Summary
- Replaces the form-driven Mutual NDA creator with a free-form AI chat that asks about each field and populates `NdaData` via LiteLLM/OpenRouter/Cerebras with Structured Outputs (`openrouter/openai/gpt-oss-120b`).
- The existing `NdaForm` survives as a collapsible "Edit fields manually" panel beneath the chat; live preview + client-side PDF download are unchanged.
- Only the Mutual NDA card is affected — other 11 templates remain "Coming soon" per the ticket's "still just mutual NDA" constraint.

## Design
See [`docs/superpowers/specs/2026-05-23-pl5-ai-chat-mutual-nda-design.md`](docs/superpowers/specs/2026-05-23-pl5-ai-chat-mutual-nda-design.md).

## Test plan
- [ ] `cd backend && uv run pytest` — all green
- [ ] `cd frontend && npm test` — all green
- [ ] `cd frontend && npm run test:e2e` — all green
- [ ] Manual smoke against real OpenRouter: end-to-end chat → PDF download
- [ ] Verify `OPENROUTER_API_KEY` never appears in container logs

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Report the PR URL back to the user.**

---

## Self-review

- **Spec coverage:** Every "Goals" bullet, every backend/frontend section, error-handling row, and testing entry in the spec maps to at least one task above. Persistence and streaming are non-goals (so no task).
- **Placeholders:** None. Every step has either an exact command or a complete code block.
- **Type consistency:** `ChatTurn`, `ChatRequest`, `ChatResponse`, `ChatMessage`, `NdaData`, `PartialNdaData`, `deep_merge_fields`, `sendChatTurn`, `ChatError`, `NdaChat`, `NdaChatApp`, `NdaEditPanel` — names used consistently across tasks. Wire shape is camelCase end-to-end; Python uses snake_case attributes with alias generator. `handle_turn` import + `chat_module.completion` monkeypatch surface match each other in Task 3 vs Tasks 4–5.
- **Caps consistent:** `MAX_HISTORY = 60` (backend) and `MAX_MESSAGES = 60` (frontend) are the same number; tests assert each independently. Mentioned in the spec.
- **Auth gating:** Task 6 covers 401-on-missing-cookie; the new `auth_client` fixture is added to `conftest.py` so other PL-* work benefits.
