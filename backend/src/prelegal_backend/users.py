from __future__ import annotations

import sqlite3
from dataclasses import dataclass

from passlib.context import CryptContext


_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


class EmailAlreadyRegistered(Exception):
    """Raised by create_with_password when the email is already in use."""


@dataclass(frozen=True)
class User:
    id: int
    email: str
    name: str
    created_at: str


def _row_to_user(row: sqlite3.Row) -> User:
    return User(
        id=row["id"],
        email=row["email"],
        name=row["name"],
        created_at=row["created_at"],
    )


def get_by_id(conn: sqlite3.Connection, user_id: int) -> User | None:
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _row_to_user(row) if row else None


def get_by_email(conn: sqlite3.Connection, email: str) -> User | None:
    row = conn.execute(
        "SELECT * FROM users WHERE email = ?", (email.strip().lower(),)
    ).fetchone()
    return _row_to_user(row) if row else None


def create_with_password(
    conn: sqlite3.Connection, *, email: str, name: str, password: str
) -> User:
    email = email.strip().lower()
    name = name.strip()
    password_hash = _pwd.hash(password)
    try:
        with conn:
            conn.execute(
                "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)",
                (email, name, password_hash),
            )
    except sqlite3.IntegrityError as exc:
        if "users.email" in str(exc):
            raise EmailAlreadyRegistered(email) from exc
        raise
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    assert row is not None
    return _row_to_user(row)


def verify_password(
    conn: sqlite3.Connection, *, email: str, password: str
) -> User | None:
    row = conn.execute(
        "SELECT * FROM users WHERE email = ?", (email.strip().lower(),)
    ).fetchone()
    if row is None:
        return None
    if not _pwd.verify(password, row["password_hash"]):
        return None
    return _row_to_user(row)
