"""POST /api/templates/mutual-nda/chat — one Structured-Outputs round-trip per turn."""

from __future__ import annotations

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


@router.post("/chat", response_model=ChatResponse, response_model_by_alias=True)
def chat(
    body: ChatRequest,
    _: Annotated[User, Depends(current_user)],
) -> ChatResponse:
    return handle_turn(body.messages, body.current_fields)
