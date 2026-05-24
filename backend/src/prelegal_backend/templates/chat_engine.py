"""Generic LiteLLM round-trip used by every template's chat endpoint.

`handle_turn` is template-agnostic: it takes a `TemplateSpec`, builds a
ChatTurn Structured-Outputs model from the spec's `partial_model`, calls
LiteLLM, validates, and deep-merges into the current snapshot.
"""

from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import HTTPException, status
from litellm import completion
from pydantic import BaseModel, ConfigDict, ValidationError, field_serializer

from .base import to_camel
from .specs import TemplateSpec

logger = logging.getLogger(__name__)

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
MAX_HISTORY = 60  # user/assistant messages forwarded to the model


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


def _build_turn_model(spec: TemplateSpec) -> type[BaseModel]:
    """ChatTurn for this spec — leaf-optional `updated_fields` keyed to the
    spec's partial model."""

    fields = {
        "assistant_message": (str, ...),
        "updated_fields": (spec.partial_model, ...),
        "is_complete": (bool, ...),
    }
    return type(
        f"ChatTurn_{spec.slug}",
        (BaseModel,),
        {
            "__annotations__": {k: v[0] for k, v in fields.items()},
            "model_config": ConfigDict(extra="forbid"),
            **{k: v[1] for k, v in fields.items()},
        },
    )


class ChatResponse(BaseModel):
    """Wire response for one chat turn.

    `merged_fields` is the per-template document data (an instance of the
    spec's `data_model`). We type it as `Any` so a single `ChatResponse`
    class can serve every template; a field serializer below produces the
    camelCase wire format by deferring to the inner model's own aliases.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

    assistant_message: str
    merged_fields: Any
    is_complete: bool

    @field_serializer("merged_fields")
    def _serialize_merged(self, value: Any) -> Any:
        if isinstance(value, BaseModel):
            return value.model_dump(by_alias=True)
        return value


def handle_turn(
    spec: TemplateSpec,
    messages: list[ChatMessage],
    current_fields: BaseModel,
) -> ChatResponse:
    """Run one chat turn for `spec`. `current_fields` must be an instance of
    `spec.data_model`."""

    bounded = messages[-MAX_HISTORY:]
    llm_messages = [
        {"role": "system", "content": spec.system_prompt(current_fields)},
    ]
    llm_messages.extend({"role": m.role, "content": m.content} for m in bounded)

    turn_model = _build_turn_model(spec)

    try:
        response = completion(
            model=MODEL,
            messages=llm_messages,
            response_format=turn_model,
            reasoning_effort="low",
            extra_body=EXTRA_BODY,
        )
    except Exception:
        logger.exception("LiteLLM completion failed for slug=%s", spec.slug)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service unavailable",
        )

    content = response.choices[0].message.content
    try:
        turn = turn_model.model_validate_json(content)
    except ValidationError:
        logger.exception(
            "Model returned malformed ChatTurn JSON for slug=%s: %s",
            spec.slug,
            content,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI returned an invalid response",
        )

    if not turn.assistant_message.strip():
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI returned an empty message",
        )

    merged = spec.deep_merge(current_fields, turn.updated_fields)
    return ChatResponse(
        assistant_message=turn.assistant_message,
        merged_fields=merged,
        is_complete=turn.is_complete,
    )
