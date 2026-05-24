"""POST /api/templates/recommend — gateway chat that maps free-text user
intent to a supported template slug (or explains we don't generate it and
offers the closest match)."""

from __future__ import annotations

import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from litellm import completion
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..auth import current_user
from ..users import User
from .base import to_camel
from .catalog import catalog_templates
from .chat_engine import EXTRA_BODY, MODEL

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/templates", tags=["template-recommend"])


class RecommendRequest(BaseModel):
    description: str


class Recommendation(BaseModel):
    """Structured-Outputs schema the model must return."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["supported", "unsupported"]
    slug: str = Field(
        description="Slug of the chosen template (matches the catalog). For"
        " `unsupported`, the closest substitute."
    )
    explanation: str = Field(
        description="One- or two-sentence explanation aimed at the user."
    )


class RecommendResponse(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    kind: Literal["supported", "unsupported"]
    slug: str
    name: str
    explanation: str


def _build_system_prompt() -> str:
    catalog = catalog_templates()
    lines = [
        "You are the entry point of a legal-document drafting tool that can"
        " produce the following documents. The user will describe what kind"
        " of document they need — your job is to map that intent to the"
        " best-fit slug in this catalog.",
        "",
        "Catalog:",
    ]
    for t in catalog:
        lines.append(f"- slug=`{t.slug}` — {t.name}: {t.description}")
    lines.extend(
        [
            "",
            "Output a JSON object that conforms to the schema with three fields:",
            "  - `kind`: `\"supported\"` if exactly the user's document is in"
            " the catalog above; `\"unsupported\"` if the user wants a"
            " different document (e.g. employment contract, lease, non-compete).",
            "  - `slug`: the catalog slug to use. For `unsupported`, the"
            " closest substitute (e.g. NDA-like → `mutual-nda`).",
            "  - `explanation`: short, friendly one- or two-sentence message"
            " for the user. For `unsupported`, name what they asked for, say"
            " we don't generate that document type yet, and recommend the"
            " closest substitute we DO generate (using its catalog name).",
        ]
    )
    return "\n".join(lines)


def recommend_for(description: str) -> RecommendResponse:
    """Call LiteLLM Structured Outputs, validate, look up the slug."""

    if not description.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Description is required",
        )

    messages = [
        {"role": "system", "content": _build_system_prompt()},
        {"role": "user", "content": description.strip()},
    ]

    try:
        response = completion(
            model=MODEL,
            messages=messages,
            response_format=Recommendation,
            reasoning_effort="low",
            extra_body=EXTRA_BODY,
        )
    except Exception:
        logger.exception("LiteLLM completion failed for recommend")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service unavailable",
        )

    content = response.choices[0].message.content
    try:
        rec = Recommendation.model_validate_json(content)
    except ValidationError:
        logger.exception("Model returned malformed Recommendation: %s", content)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI returned an invalid response",
        )

    catalog = {t.slug: t for t in catalog_templates()}
    if rec.slug not in catalog:
        logger.warning(
            "Model returned slug=%s not in catalog; falling back to mutual-nda",
            rec.slug,
        )
        rec = rec.model_copy(update={"slug": "mutual-nda", "kind": "unsupported"})

    return RecommendResponse(
        kind=rec.kind,
        slug=rec.slug,
        name=catalog[rec.slug].name,
        explanation=rec.explanation,
    )


@router.post(
    "/recommend",
    response_model=RecommendResponse,
    response_model_by_alias=True,
)
def recommend(
    body: RecommendRequest,
    _: Annotated[User, Depends(current_user)],
) -> RecommendResponse:
    return recommend_for(body.description)
