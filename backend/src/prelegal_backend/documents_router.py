"""REST endpoints for per-user saved document drafts."""

from __future__ import annotations

import sqlite3
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from . import documents
from .auth import current_user, get_db
from .templates.base import to_camel
from .templates.specs import get_spec
from .users import User


router = APIRouter(prefix="/api/documents", tags=["documents"])


class _CreateBody(BaseModel):
    slug: str
    title: str | None = None
    fields: dict[str, Any]


class _PatchBody(BaseModel):
    title: str | None = None
    fields: dict[str, Any] | None = None


class DocumentOut(BaseModel):
    """Full document — used by create / get / patch responses."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: int
    slug: str
    title: str
    fields: dict[str, Any]
    updated_at: str = Field(serialization_alias="updatedAt")


class DocumentSummaryOut(BaseModel):
    """Lightweight summary returned by GET /api/documents (no fields blob)."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: int
    slug: str
    title: str
    updated_at: str = Field(serialization_alias="updatedAt")


def _to_full(doc: documents.Document) -> DocumentOut:
    return DocumentOut(
        id=doc.id,
        slug=doc.slug,
        title=doc.title,
        fields=doc.fields,
        updated_at=doc.updated_at,
    )


def _to_summary(doc: documents.Document) -> DocumentSummaryOut:
    return DocumentSummaryOut(
        id=doc.id, slug=doc.slug, title=doc.title, updated_at=doc.updated_at
    )


@router.post(
    "",
    response_model=DocumentOut,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def create_document(
    body: _CreateBody,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[sqlite3.Connection, Depends(get_db)],
) -> DocumentOut:
    if get_spec(body.slug) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown template slug: {body.slug}",
        )
    doc = documents.create(
        db,
        user_id=user.id,
        slug=body.slug,
        title=body.title,
        fields=body.fields,
    )
    return _to_full(doc)


@router.get(
    "",
    response_model=list[DocumentSummaryOut],
    response_model_by_alias=True,
)
def list_documents(
    user: Annotated[User, Depends(current_user)],
    db: Annotated[sqlite3.Connection, Depends(get_db)],
    slug: str | None = None,
) -> list[DocumentSummaryOut]:
    rows = documents.list_for_user(db, user_id=user.id, slug=slug)
    return [_to_summary(d) for d in rows]


@router.get(
    "/{doc_id}",
    response_model=DocumentOut,
    response_model_by_alias=True,
)
def get_document(
    doc_id: int,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[sqlite3.Connection, Depends(get_db)],
) -> DocumentOut:
    try:
        doc = documents.get_by_id(db, user_id=user.id, doc_id=doc_id)
    except documents.DocumentNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return _to_full(doc)


@router.patch(
    "/{doc_id}",
    response_model=DocumentOut,
    response_model_by_alias=True,
)
def update_document(
    doc_id: int,
    body: _PatchBody,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[sqlite3.Connection, Depends(get_db)],
) -> DocumentOut:
    try:
        doc = documents.update(
            db,
            user_id=user.id,
            doc_id=doc_id,
            title=body.title,
            fields=body.fields,
        )
    except documents.DocumentNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return _to_full(doc)


@router.delete(
    "/{doc_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_document(
    doc_id: int,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[sqlite3.Connection, Depends(get_db)],
) -> None:
    try:
        documents.delete(db, user_id=user.id, doc_id=doc_id)
    except documents.DocumentNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
