from __future__ import annotations

import pytest

from prelegal_backend import db as db_module
from prelegal_backend.users import (
    EmailAlreadyRegistered,
    create_with_password,
    verify_password,
)


@pytest.fixture
def conn(tmp_path):
    c = db_module.connect(tmp_path / "users.db")
    db_module.init_schema(c)
    yield c
    c.close()


def test_create_with_password_stores_bcrypt_hash(conn) -> None:
    user = create_with_password(
        conn, email="Ada@Example.com", name="Ada", password="hunter22-secret"
    )
    assert user.id > 0
    assert user.email == "ada@example.com"
    assert user.name == "Ada"
    row = conn.execute(
        "SELECT password_hash FROM users WHERE id = ?", (user.id,)
    ).fetchone()
    assert row["password_hash"].startswith("$2b$")


def test_create_with_password_rejects_duplicate_email(conn) -> None:
    create_with_password(
        conn, email="ada@example.com", name="Ada", password="hunter22-secret"
    )
    with pytest.raises(EmailAlreadyRegistered):
        create_with_password(
            conn,
            email="ada@example.com",
            name="Ada Again",
            password="hunter22-secret",
        )


def test_verify_password_returns_user_on_match(conn) -> None:
    create_with_password(
        conn, email="ada@example.com", name="Ada", password="hunter22-secret"
    )
    user = verify_password(
        conn, email="Ada@Example.com", password="hunter22-secret"
    )
    assert user is not None
    assert user.email == "ada@example.com"


def test_verify_password_returns_none_on_wrong_password(conn) -> None:
    create_with_password(
        conn, email="ada@example.com", name="Ada", password="hunter22-secret"
    )
    assert verify_password(conn, email="ada@example.com", password="wrong") is None


def test_verify_password_returns_none_on_unknown_email(conn) -> None:
    assert (
        verify_password(conn, email="nobody@example.com", password="anything")
        is None
    )
