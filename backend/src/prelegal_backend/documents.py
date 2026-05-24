"""Document persistence: per-user saved drafts."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from typing import Any

from .templates.specs import get_spec


class DocumentNotFound(Exception):
    """Raised when the requested document doesn't exist or isn't owned by the
    caller. (Same exception for both — don't leak existence.)"""


@dataclass(frozen=True)
class Document:
    id: int
    user_id: int
    slug: str
    title: str
    fields: dict[str, Any]
    created_at: str
    updated_at: str


def _row_to_doc(row: sqlite3.Row) -> Document:
    return Document(
        id=row["id"],
        user_id=row["user_id"],
        slug=row["slug"],
        title=row["title"],
        fields=json.loads(row["fields_json"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _party_companies(slug: str, fields: dict[str, Any]) -> list[str]:
    if slug == "mutual-nda":
        return [
            (fields.get("party1") or {}).get("company", ""),
            (fields.get("party2") or {}).get("company", ""),
        ]
    parties = fields.get("parties") or []
    return [(p or {}).get("company", "") for p in parties]


def derive_title(slug: str, fields: dict[str, Any]) -> str:
    """Build a human title from party company names; fall back to '<spec.name> draft'."""

    companies = [
        c.strip() for c in _party_companies(slug, fields) if c and c.strip()
    ]
    if len(companies) >= 2:
        return f"{companies[0]} ↔ {companies[1]}"
    if len(companies) == 1:
        return companies[0]
    spec = get_spec(slug)
    spec_name = spec.name if spec else slug
    return f"{spec_name} draft"


def create(
    conn: sqlite3.Connection,
    *,
    user_id: int,
    slug: str,
    title: str | None,
    fields: dict[str, Any],
) -> Document:
    final_title = (
        title.strip() if title and title.strip() else derive_title(slug, fields)
    )
    with conn:
        cur = conn.execute(
            "INSERT INTO documents (user_id, slug, title, fields_json) "
            "VALUES (?, ?, ?, ?)",
            (user_id, slug, final_title, json.dumps(fields)),
        )
        doc_id = cur.lastrowid
    row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    assert row is not None
    return _row_to_doc(row)


def list_for_user(
    conn: sqlite3.Connection, *, user_id: int, slug: str | None
) -> list[Document]:
    if slug is None:
        rows = conn.execute(
            "SELECT * FROM documents WHERE user_id = ? "
            "ORDER BY updated_at DESC, id DESC",
            (user_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM documents WHERE user_id = ? AND slug = ? "
            "ORDER BY updated_at DESC, id DESC",
            (user_id, slug),
        ).fetchall()
    return [_row_to_doc(r) for r in rows]


def get_by_id(
    conn: sqlite3.Connection, *, user_id: int, doc_id: int
) -> Document:
    row = conn.execute(
        "SELECT * FROM documents WHERE id = ? AND user_id = ?",
        (doc_id, user_id),
    ).fetchone()
    if row is None:
        raise DocumentNotFound(doc_id)
    return _row_to_doc(row)


def update(
    conn: sqlite3.Connection,
    *,
    user_id: int,
    doc_id: int,
    title: str | None,
    fields: dict[str, Any] | None,
) -> Document:
    current = get_by_id(conn, user_id=user_id, doc_id=doc_id)
    new_fields = fields if fields is not None else current.fields
    if title is not None and title.strip():
        new_title = title.strip()
    elif fields is not None:
        new_title = derive_title(current.slug, new_fields)
    else:
        new_title = current.title
    with conn:
        conn.execute(
            "UPDATE documents SET title = ?, fields_json = ?, "
            "updated_at = datetime('now', 'subsec') "
            "WHERE id = ? AND user_id = ?",
            (new_title, json.dumps(new_fields), doc_id, user_id),
        )
    return get_by_id(conn, user_id=user_id, doc_id=doc_id)


def delete(conn: sqlite3.Connection, *, user_id: int, doc_id: int) -> None:
    with conn:
        cur = conn.execute(
            "DELETE FROM documents WHERE id = ? AND user_id = ?",
            (doc_id, user_id),
        )
        if cur.rowcount == 0:
            raise DocumentNotFound(doc_id)
