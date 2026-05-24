"""POST /api/templates/{slug}/chat — dispatches to the registered spec."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ValidationError

from ..auth import current_user
from ..users import User
from .chat_engine import ChatMessage, ChatResponse, handle_turn
from .specs import get_spec

router = APIRouter(prefix="/api/templates", tags=["template-chat"])


class _RawChatRequest(BaseModel):
    messages: list[ChatMessage]
    current_fields: dict[str, Any]


@router.post(
    "/{slug}/chat",
    response_model=ChatResponse,
    response_model_by_alias=True,
)
def chat(
    slug: str,
    body: _RawChatRequest,
    _: Annotated[User, Depends(current_user)],
) -> ChatResponse:
    spec = get_spec(slug)
    if spec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown template slug: {slug}",
        )
    try:
        current = spec.data_model.model_validate(body.current_fields)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid current_fields for {slug}: {exc.errors()}",
        )
    return handle_turn(spec, body.messages, current)
