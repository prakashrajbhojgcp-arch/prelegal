from __future__ import annotations

import sqlite3
from dataclasses import dataclass


@dataclass(frozen=True)
class User:
    id: int
    email: str
    name: str
    created_at: str


def _row_to_user(row: sqlite3.Row) -> User:
    return User(id=row["id"], email=row["email"], name=row["name"], created_at=row["created_at"])


def get_by_id(conn: sqlite3.Connection, user_id: int) -> User | None:
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _row_to_user(row) if row else None


def get_or_create_by_email(conn: sqlite3.Connection, email: str, name: str) -> User:
    email = email.strip().lower()
    name = name.strip()
    with conn:
        conn.execute(
            "INSERT INTO users (email, name) VALUES (?, ?) "
            "ON CONFLICT(email) DO UPDATE SET name = excluded.name",
            (email, name),
        )
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    assert row is not None  # upsert just ran
    return _row_to_user(row)
