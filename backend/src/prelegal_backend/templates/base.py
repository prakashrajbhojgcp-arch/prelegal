"""Shared Pydantic base + alias helpers used by every template schema."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


def to_camel(s: str) -> str:
    head, *tail = s.split("_")
    return head + "".join(w.capitalize() for w in tail)


class _Base(BaseModel):
    """Strict camelCase-wire / snake_case-attr base for template schemas."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )
