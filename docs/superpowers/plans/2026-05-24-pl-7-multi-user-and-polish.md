# PL-7 — Multi-user and final polish · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fake-auth with real email+password sign-up/sign-in, persist per-user document drafts with explicit save + resume, add the draft disclaimer everywhere it needs to be, polish the auth / dashboard / creator screens to feel like a SaaS product, and refresh `frontend/CLAUDE.md`.

**Architecture:** New `users.password_hash` column + `documents` table in SQLite. `passlib[bcrypt]` for hashing. Two new backend modules (`documents.py`, `documents_router.py`) following the existing auth/templates router pattern. One new shared frontend `AuthForm` component handles both sign-in and sign-up modes. Drafts are saved with an explicit button per creator page and surfaced via a `SavedDraftsPanel` adjacent to the chat sidebar. The draft disclaimer is centralized in `lib/disclaimer.ts` and rendered in three places (creator banner, PDF footer, dashboard note). `UserMenu` replaces the standalone logout button in the top bar.

**Tech stack:** FastAPI · SQLite (sqlite3 stdlib) · passlib[bcrypt] · Pydantic v2 · Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · @react-pdf/renderer · pytest · vitest · @testing-library/react.

**Related design doc:** `docs/superpowers/specs/2026-05-24-pl-7-multi-user-and-polish-design.md`.

---

## File map

### Backend
- **Modify** `backend/pyproject.toml` — add `passlib[bcrypt]` dependency.
- **Modify** `backend/src/prelegal_backend/db.py` — extend SCHEMA with `password_hash` + `documents` table.
- **Modify** `backend/src/prelegal_backend/users.py` — add `EmailAlreadyRegistered`, `create_with_password`, `verify_password`; remove `get_or_create_by_email` callers in auth.py rely on.
- **Modify** `backend/src/prelegal_backend/auth.py` — new `/signup` endpoint; rewrite `/login` to require password.
- **Create** `backend/src/prelegal_backend/documents.py` — `Document` dataclass + CRUD helpers + `derive_title(slug, fields)`.
- **Create** `backend/src/prelegal_backend/documents_router.py` — `POST/GET/PATCH/DELETE /api/documents`.
- **Modify** `backend/src/prelegal_backend/main.py` — mount `documents_router`.
- **Modify** `backend/tests/conftest.py` — `auth_client` fixture uses real signup.
- **Modify** `backend/tests/test_auth.py` — rewrite around signup/login with password.
- **Create** `backend/tests/test_documents.py` — CRUD + auth gating + user isolation.

### Frontend
- **Create** `frontend/src/lib/disclaimer.ts` — `DISCLAIMER_FULL` + `DISCLAIMER_FOOTER` constants.
- **Create** `frontend/src/components/auth-form.tsx` — single component, `mode: "signin" | "signup"`, replaces `LoginForm`.
- **Delete** `frontend/src/components/login-form.tsx` and any unused references.
- **Modify** `frontend/src/app/login/page.tsx` — two-column SaaS layout with `<AuthForm />`.
- **Create** `frontend/src/components/draft-disclaimer-banner.tsx` — amber banner.
- **Modify** `frontend/src/app/dashboard/page.tsx` — hero + dashboard disclaimer note row.
- **Modify** `frontend/src/lib/templates/mutual-nda/pdf-document.tsx` — fixed PDF footer.
- **Modify** `frontend/src/lib/templates/generic/pdf-document.tsx` — fixed PDF footer.
- **Create** `frontend/src/lib/templates/documents-client.ts` — typed REST client.
- **Create** `frontend/src/components/saved-drafts-panel.tsx` — list / resume / delete UI.
- **Modify** `frontend/src/components/template-chat-app.tsx` — banner + save state + drafts panel + resume.
- **Modify** `frontend/src/components/nda-chat-app.tsx` — same.
- **Create** `frontend/src/components/user-menu.tsx` — avatar dropdown with sign-out.
- **Modify** `frontend/src/components/shell/top-bar.tsx` — render `<UserMenu />` instead of name + `<LogoutButton />`.
- **Delete** `frontend/src/components/logout-button.tsx` (sign-out now lives inside `UserMenu`).
- **Modify** `frontend/CLAUDE.md` — refresh status to post-PL-7.
- **Create** `frontend/src/components/__tests__/auth-form.test.tsx`.
- **Create** `frontend/src/components/__tests__/saved-drafts-panel.test.tsx`.
- **Create** `frontend/src/components/__tests__/draft-disclaimer-banner.test.tsx`.
- **Create** `frontend/src/components/__tests__/user-menu.test.tsx`.

---

## Task 1: Add password hashing to `users.py`

**Files:**
- Modify: `backend/pyproject.toml`
- Modify: `backend/src/prelegal_backend/db.py:7-14`
- Modify: `backend/src/prelegal_backend/users.py` (rewrite the file body)
- Test: `backend/tests/test_users.py` (new — separate from `test_auth.py` so the unit layer is tested directly)

- [ ] **Step 1: Add the passlib dependency**

In `backend/pyproject.toml`, append to `dependencies`:

```toml
    "litellm>=1.85.1",
    "passlib[bcrypt]>=1.7.4",
]
```

Run from the repo root:
```bash
cd backend && uv sync && cd ..
```
Expected: `uv.lock` updated, `passlib` resolved.

- [ ] **Step 2: Extend the SQL schema**

Replace `backend/src/prelegal_backend/db.py` lines 7-14 with:

```python
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""
```

- [ ] **Step 3: Write the failing unit tests**

Create `backend/tests/test_users.py`:

```python
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
    user = create_with_password(conn, email="Ada@Example.com", name="Ada", password="hunter22-secret")
    assert user.id > 0
    assert user.email == "ada@example.com"  # lower-cased
    assert user.name == "Ada"
    row = conn.execute("SELECT password_hash FROM users WHERE id = ?", (user.id,)).fetchone()
    # bcrypt hashes start with "$2b$" (modular crypt format).
    assert row["password_hash"].startswith("$2b$")


def test_create_with_password_rejects_duplicate_email(conn) -> None:
    create_with_password(conn, email="ada@example.com", name="Ada", password="hunter22-secret")
    with pytest.raises(EmailAlreadyRegistered):
        create_with_password(conn, email="ada@example.com", name="Ada Again", password="hunter22-secret")


def test_verify_password_returns_user_on_match(conn) -> None:
    create_with_password(conn, email="ada@example.com", name="Ada", password="hunter22-secret")
    user = verify_password(conn, email="Ada@Example.com", password="hunter22-secret")
    assert user is not None
    assert user.email == "ada@example.com"


def test_verify_password_returns_none_on_wrong_password(conn) -> None:
    create_with_password(conn, email="ada@example.com", name="Ada", password="hunter22-secret")
    assert verify_password(conn, email="ada@example.com", password="wrong") is None


def test_verify_password_returns_none_on_unknown_email(conn) -> None:
    assert verify_password(conn, email="nobody@example.com", password="anything") is None
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_users.py -v
```
Expected: All 5 tests fail with `ImportError` for `EmailAlreadyRegistered`, `create_with_password`, `verify_password`.

- [ ] **Step 5: Implement `users.py`**

Replace the body of `backend/src/prelegal_backend/users.py` with:

```python
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
    assert row is not None  # we just inserted
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
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/test_users.py -v
```
Expected: all 5 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/src/prelegal_backend/db.py backend/src/prelegal_backend/users.py backend/tests/test_users.py
git commit -m "PL-7: hash user passwords with bcrypt"
```

---

## Task 2: Rewrite `/api/auth/signup` and `/api/auth/login`

**Files:**
- Modify: `backend/src/prelegal_backend/auth.py`
- Modify: `backend/tests/test_auth.py`
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Rewrite the auth tests (TDD)**

Replace `backend/tests/test_auth.py` with:

```python
from fastapi.testclient import TestClient


def signup(
    client: TestClient,
    *,
    email: str = "ada@example.com",
    name: str = "Ada Lovelace",
    password: str = "hunter22-secret",
):
    return client.post(
        "/api/auth/signup",
        json={"email": email, "name": name, "password": password},
    )


def login(
    client: TestClient,
    *,
    email: str = "ada@example.com",
    password: str = "hunter22-secret",
):
    return client.post(
        "/api/auth/login", json={"email": email, "password": password}
    )


def test_signup_creates_user_and_sets_cookie(client: TestClient) -> None:
    response = signup(client)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == "ada@example.com"
    assert body["name"] == "Ada Lovelace"
    assert isinstance(body["id"], int)
    assert "prelegal_session" in response.cookies


def test_signup_duplicate_email_returns_409(client: TestClient) -> None:
    first = signup(client)
    assert first.status_code == 201
    second = signup(client, name="Ada Again")
    assert second.status_code == 409
    assert second.json()["detail"] == "An account already exists for that email."


def test_signup_rejects_short_password(client: TestClient) -> None:
    response = signup(client, password="short")
    assert response.status_code == 422


def test_signup_rejects_blank_name(client: TestClient) -> None:
    response = signup(client, name="")
    assert response.status_code == 422


def test_signup_rejects_invalid_email(client: TestClient) -> None:
    response = signup(client, email="not-an-email")
    assert response.status_code == 422


def test_login_returns_user_and_sets_cookie(client: TestClient) -> None:
    signup(client)
    response = login(client)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["email"] == "ada@example.com"
    assert body["name"] == "Ada Lovelace"
    assert "prelegal_session" in response.cookies


def test_login_with_wrong_password_returns_401(client: TestClient) -> None:
    signup(client)
    response = login(client, password="wrong-password")
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_login_with_unknown_email_returns_401(client: TestClient) -> None:
    response = login(client, email="nobody@example.com")
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_me_requires_session(client: TestClient) -> None:
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_me_returns_user_after_signup(client: TestClient) -> None:
    signup(client)
    response = client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["email"] == "ada@example.com"


def test_logout_clears_session(client: TestClient) -> None:
    signup(client)
    response = client.post("/api/auth/logout")
    assert response.status_code == 204
    set_cookie = response.headers.get("set-cookie", "")
    assert "prelegal_session=" in set_cookie
    assert ("Max-Age=0" in set_cookie) or ("expires=" in set_cookie.lower())
    follow_up = client.get("/api/auth/me")
    assert follow_up.status_code == 401


def test_tampered_cookie_is_rejected(client: TestClient) -> None:
    signup(client)
    client.cookies.set("prelegal_session", "obviously-not-signed")
    response = client.get("/api/auth/me")
    assert response.status_code == 401
```

- [ ] **Step 2: Update conftest's `auth_client`**

Replace `backend/tests/conftest.py` lines 27-36 with:

```python
@pytest.fixture
def auth_client(client: TestClient) -> TestClient:
    """A TestClient that has already signed up and is logged in."""
    response = client.post(
        "/api/auth/signup",
        json={
            "email": "chat-tester@example.com",
            "name": "Chat Tester",
            "password": "hunter22-secret",
        },
    )
    assert response.status_code == 201, response.text
    return client
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_auth.py -v
```
Expected: tests fail because `/api/auth/signup` doesn't exist yet and the login endpoint still expects `name`.

- [ ] **Step 4: Implement signup + rewrite login**

Replace `backend/src/prelegal_backend/auth.py` (full file body):

```python
from __future__ import annotations

import sqlite3
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from itsdangerous import BadSignature, URLSafeSerializer
from pydantic import BaseModel, EmailStr, Field

from . import users
from .settings import settings


def _serializer() -> URLSafeSerializer:
    return URLSafeSerializer(settings.session_secret, salt="prelegal-session")


def _issue_cookie(response: Response, user_id: int) -> None:
    token = _serializer().dumps({"user_id": user_id})
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_max_age_seconds,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )


def _clear_cookie(response: Response) -> None:
    response.delete_cookie(key=settings.session_cookie_name, path="/")


def _user_id_from_cookie(token: str | None) -> int | None:
    if not token:
        return None
    try:
        payload = _serializer().loads(token)
    except BadSignature:
        return None
    user_id = payload.get("user_id") if isinstance(payload, dict) else None
    return int(user_id) if isinstance(user_id, int) else None


def get_db(request: Request) -> sqlite3.Connection:
    return request.app.state.db


def current_user(
    db: Annotated[sqlite3.Connection, Depends(get_db)],
    session_token: Annotated[str | None, Cookie(alias=settings.session_cookie_name)] = None,
) -> users.User:
    user_id = _user_id_from_cookie(session_token)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not signed in")
    user = users.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not signed in")
    return user


class SignupRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class UserOut(BaseModel):
    id: int
    email: str
    name: str

    @classmethod
    def from_user(cls, user: users.User) -> "UserOut":
        return cls(id=user.id, email=user.email, name=user.name)


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post(
    "/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED
)
def signup(
    body: SignupRequest,
    response: Response,
    db: Annotated[sqlite3.Connection, Depends(get_db)],
) -> UserOut:
    try:
        user = users.create_with_password(
            db, email=body.email, name=body.name, password=body.password
        )
    except users.EmailAlreadyRegistered:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already exists for that email.",
        )
    _issue_cookie(response, user.id)
    return UserOut.from_user(user)


@router.post("/login", response_model=UserOut)
def login(
    body: LoginRequest,
    response: Response,
    db: Annotated[sqlite3.Connection, Depends(get_db)],
) -> UserOut:
    user = users.verify_password(db, email=body.email, password=body.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    _issue_cookie(response, user.id)
    return UserOut.from_user(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    _clear_cookie(response)


@router.get("/me", response_model=UserOut)
def me(user: Annotated[users.User, Depends(current_user)]) -> UserOut:
    return UserOut.from_user(user)
```

- [ ] **Step 5: Run the full auth test suite**

```bash
cd backend && uv run pytest tests/test_auth.py tests/test_users.py -v
```
Expected: all PASS.

- [ ] **Step 6: Run the entire backend suite (catch regressions in chat/recommend/templates that use `auth_client`)**

```bash
cd backend && uv run pytest -q
```
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/prelegal_backend/auth.py backend/tests/test_auth.py backend/tests/conftest.py
git commit -m "PL-7: signup + password login endpoints"
```

---

## Task 3: SQLite schema + `documents.py` CRUD module

**Files:**
- Modify: `backend/src/prelegal_backend/db.py:7-14`
- Create: `backend/src/prelegal_backend/documents.py`
- Create: `backend/tests/test_documents_module.py` (unit tests against the conn directly; the router tests come in Task 4)

- [ ] **Step 1: Extend the schema with the documents table**

In `backend/src/prelegal_backend/db.py`, extend the SCHEMA constant so it includes both `users` (already updated in Task 1) and the new `documents` table:

```python
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    fields_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_user_slug
    ON documents(user_id, slug, updated_at DESC);
"""
```

- [ ] **Step 2: Write the failing unit tests**

Create `backend/tests/test_documents_module.py`:

```python
from __future__ import annotations

import time

import pytest

from prelegal_backend import db as db_module
from prelegal_backend.documents import (
    DocumentNotFound,
    create,
    delete,
    derive_title,
    get_by_id,
    list_for_user,
    update,
)
from prelegal_backend.users import create_with_password


@pytest.fixture
def conn(tmp_path):
    c = db_module.connect(tmp_path / "docs.db")
    db_module.init_schema(c)
    yield c
    c.close()


@pytest.fixture
def alice_id(conn) -> int:
    return create_with_password(
        conn, email="alice@example.com", name="Alice", password="hunter22-secret"
    ).id


@pytest.fixture
def bob_id(conn) -> int:
    return create_with_password(
        conn, email="bob@example.com", name="Bob", password="hunter22-secret"
    ).id


def test_create_persists_fields_json_and_derived_title(conn, alice_id) -> None:
    doc = create(
        conn,
        user_id=alice_id,
        slug="mutual-nda",
        title=None,
        fields={
            "purpose": "Evaluating a deal.",
            "party1": {"company": "Acme"},
            "party2": {"company": "Globex"},
        },
    )
    assert doc.id > 0
    assert doc.slug == "mutual-nda"
    assert doc.title == "Acme ↔ Globex"
    assert doc.fields["purpose"] == "Evaluating a deal."


def test_create_with_explicit_title_overrides_derivation(conn, alice_id) -> None:
    doc = create(
        conn,
        user_id=alice_id,
        slug="csa",
        title="Q3 cloud renewal",
        fields={"parties": [{"company": "Acme"}, {"company": "Globex"}]},
    )
    assert doc.title == "Q3 cloud renewal"


def test_list_for_user_sorted_by_updated_at_desc(conn, alice_id) -> None:
    first = create(
        conn,
        user_id=alice_id,
        slug="csa",
        title="first",
        fields={"parties": [{"company": ""}, {"company": ""}]},
    )
    time.sleep(0.01)
    second = create(
        conn,
        user_id=alice_id,
        slug="csa",
        title="second",
        fields={"parties": [{"company": ""}, {"company": ""}]},
    )
    rows = list_for_user(conn, user_id=alice_id, slug=None)
    assert [r.id for r in rows] == [second.id, first.id]


def test_list_for_user_filters_by_slug(conn, alice_id) -> None:
    create(
        conn,
        user_id=alice_id,
        slug="csa",
        title="a",
        fields={"parties": [{"company": ""}, {"company": ""}]},
    )
    create(
        conn,
        user_id=alice_id,
        slug="baa",
        title="b",
        fields={"parties": [{"company": ""}, {"company": ""}]},
    )
    rows = list_for_user(conn, user_id=alice_id, slug="baa")
    assert {r.slug for r in rows} == {"baa"}


def test_get_by_id_isolates_users(conn, alice_id, bob_id) -> None:
    doc = create(
        conn,
        user_id=alice_id,
        slug="csa",
        title="t",
        fields={"parties": [{"company": ""}, {"company": ""}]},
    )
    with pytest.raises(DocumentNotFound):
        get_by_id(conn, user_id=bob_id, doc_id=doc.id)
    fetched = get_by_id(conn, user_id=alice_id, doc_id=doc.id)
    assert fetched.id == doc.id


def test_update_only_provided_leaves_and_advances_updated_at(conn, alice_id) -> None:
    doc = create(
        conn,
        user_id=alice_id,
        slug="csa",
        title="t",
        fields={"parties": [{"company": "old"}, {"company": ""}], "fees": ""},
    )
    time.sleep(0.01)
    updated = update(
        conn,
        user_id=alice_id,
        doc_id=doc.id,
        title="new-title",
        fields={
            "parties": [{"company": "new"}, {"company": ""}],
            "fees": "$10k/mo",
        },
    )
    assert updated.title == "new-title"
    assert updated.fields["fees"] == "$10k/mo"
    assert updated.fields["parties"][0]["company"] == "new"
    assert updated.updated_at > doc.updated_at


def test_update_raises_for_other_user(conn, alice_id, bob_id) -> None:
    doc = create(
        conn,
        user_id=alice_id,
        slug="csa",
        title="t",
        fields={"parties": [{"company": ""}, {"company": ""}]},
    )
    with pytest.raises(DocumentNotFound):
        update(
            conn,
            user_id=bob_id,
            doc_id=doc.id,
            title="hacked",
            fields=None,
        )


def test_delete_isolates_users(conn, alice_id, bob_id) -> None:
    doc = create(
        conn,
        user_id=alice_id,
        slug="csa",
        title="t",
        fields={"parties": [{"company": ""}, {"company": ""}]},
    )
    with pytest.raises(DocumentNotFound):
        delete(conn, user_id=bob_id, doc_id=doc.id)
    delete(conn, user_id=alice_id, doc_id=doc.id)
    with pytest.raises(DocumentNotFound):
        get_by_id(conn, user_id=alice_id, doc_id=doc.id)


def test_derive_title_mutual_nda_uses_party_companies() -> None:
    title = derive_title(
        "mutual-nda",
        {
            "party1": {"company": "Acme Robotics"},
            "party2": {"company": "Globex Holdings"},
        },
    )
    assert title == "Acme Robotics ↔ Globex Holdings"


def test_derive_title_generic_uses_parties_list() -> None:
    title = derive_title(
        "csa",
        {"parties": [{"company": "Acme"}, {"company": "Globex"}]},
    )
    assert title == "Acme ↔ Globex"


def test_derive_title_falls_back_when_companies_blank() -> None:
    title = derive_title(
        "mutual-nda",
        {"party1": {"company": ""}, "party2": {"company": ""}},
    )
    assert title == "Mutual NDA draft"
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_documents_module.py -v
```
Expected: all fail with `ImportError` for `prelegal_backend.documents`.

- [ ] **Step 4: Implement `documents.py`**

Create `backend/src/prelegal_backend/documents.py`:

```python
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

    companies = [c.strip() for c in _party_companies(slug, fields) if c and c.strip()]
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
    final_title = title.strip() if title and title.strip() else derive_title(slug, fields)
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
```

- [ ] **Step 5: Run unit tests**

```bash
cd backend && uv run pytest tests/test_documents_module.py -v
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/prelegal_backend/db.py backend/src/prelegal_backend/documents.py backend/tests/test_documents_module.py
git commit -m "PL-7: documents table + CRUD helpers"
```

---

## Task 4: `/api/documents` router

**Files:**
- Create: `backend/src/prelegal_backend/documents_router.py`
- Modify: `backend/src/prelegal_backend/main.py`
- Create: `backend/tests/test_documents.py`

- [ ] **Step 1: Write the failing router tests**

Create `backend/tests/test_documents.py`:

```python
from __future__ import annotations

from fastapi.testclient import TestClient


def _signup(client: TestClient, *, email: str, name: str) -> None:
    response = client.post(
        "/api/auth/signup",
        json={"email": email, "name": name, "password": "hunter22-secret"},
    )
    assert response.status_code == 201, response.text


def _alice_fields() -> dict:
    return {
        "purpose": "Evaluating a deal.",
        "effectiveDate": "2026-05-24",
        "mndaTerm": {"kind": "years", "years": 1},
        "confidentialityTerm": {"kind": "years", "years": 1},
        "governingLaw": "",
        "jurisdiction": "",
        "modifications": "",
        "party1": {"name": "", "title": "", "company": "Acme", "noticeAddress": "", "date": "2026-05-24"},
        "party2": {"name": "", "title": "", "company": "Globex", "noticeAddress": "", "date": "2026-05-24"},
    }


def test_create_returns_201_and_derived_title(client: TestClient) -> None:
    _signup(client, email="alice@example.com", name="Alice")
    response = client.post(
        "/api/documents",
        json={"slug": "mutual-nda", "fields": _alice_fields()},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["slug"] == "mutual-nda"
    assert body["title"] == "Acme ↔ Globex"
    assert body["fields"]["party1"]["company"] == "Acme"
    assert "updatedAt" in body
    assert isinstance(body["id"], int)


def test_list_returns_only_my_documents_and_filters_by_slug(
    client: TestClient,
) -> None:
    _signup(client, email="alice@example.com", name="Alice")
    a = client.post(
        "/api/documents",
        json={"slug": "mutual-nda", "fields": _alice_fields()},
    ).json()
    b = client.post(
        "/api/documents",
        json={
            "slug": "csa",
            "fields": {"parties": [{"company": "X"}, {"company": "Y"}]},
        },
    ).json()
    all_docs = client.get("/api/documents").json()
    assert {d["id"] for d in all_docs} == {a["id"], b["id"]}
    nda_only = client.get("/api/documents?slug=mutual-nda").json()
    assert [d["id"] for d in nda_only] == [a["id"]]
    # Listing does NOT include the heavy fields blob.
    assert "fields" not in nda_only[0]


def test_get_returns_full_doc_with_fields(client: TestClient) -> None:
    _signup(client, email="alice@example.com", name="Alice")
    created = client.post(
        "/api/documents",
        json={"slug": "mutual-nda", "fields": _alice_fields()},
    ).json()
    fetched = client.get(f"/api/documents/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["fields"]["party1"]["company"] == "Acme"


def test_patch_updates_fields_and_advances_updated_at(client: TestClient) -> None:
    _signup(client, email="alice@example.com", name="Alice")
    created = client.post(
        "/api/documents",
        json={"slug": "mutual-nda", "fields": _alice_fields()},
    ).json()
    updated_payload = _alice_fields()
    updated_payload["governingLaw"] = "Delaware"
    response = client.patch(
        f"/api/documents/{created['id']}",
        json={"fields": updated_payload, "title": "Acme/Globex MNDA"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Acme/Globex MNDA"
    assert body["fields"]["governingLaw"] == "Delaware"
    assert body["updatedAt"] >= created["updatedAt"]


def test_delete_removes_the_document(client: TestClient) -> None:
    _signup(client, email="alice@example.com", name="Alice")
    created = client.post(
        "/api/documents",
        json={"slug": "mutual-nda", "fields": _alice_fields()},
    ).json()
    response = client.delete(f"/api/documents/{created['id']}")
    assert response.status_code == 204
    assert client.get(f"/api/documents/{created['id']}").status_code == 404


def test_get_of_another_users_doc_is_404(client: TestClient) -> None:
    _signup(client, email="alice@example.com", name="Alice")
    alice_doc = client.post(
        "/api/documents",
        json={"slug": "mutual-nda", "fields": _alice_fields()},
    ).json()
    client.post("/api/auth/logout")
    _signup(client, email="bob@example.com", name="Bob")
    response = client.get(f"/api/documents/{alice_doc['id']}")
    assert response.status_code == 404


def test_unknown_slug_returns_400_on_create(client: TestClient) -> None:
    _signup(client, email="alice@example.com", name="Alice")
    response = client.post(
        "/api/documents",
        json={"slug": "no-such-slug", "fields": {}},
    )
    assert response.status_code == 400
    assert "Unknown template slug" in response.json()["detail"]


def test_all_endpoints_require_auth(client: TestClient) -> None:
    assert client.post("/api/documents", json={"slug": "mutual-nda", "fields": {}}).status_code == 401
    assert client.get("/api/documents").status_code == 401
    assert client.get("/api/documents/1").status_code == 401
    assert client.patch("/api/documents/1", json={"fields": {}}).status_code == 401
    assert client.delete("/api/documents/1").status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_documents.py -v
```
Expected: every test fails with `404` because the routes don't exist.

- [ ] **Step 3: Implement the router**

Create `backend/src/prelegal_backend/documents_router.py`:

```python
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
```

- [ ] **Step 4: Mount the router in `main.py`**

Open `backend/src/prelegal_backend/main.py` and add the import + include:

Replace the import line `from . import auth, db, templates` with:

```python
from . import auth, db, documents_router, templates
```

And in `create_app()`, after the existing `include_router` calls, add:

```python
    app.include_router(documents_router.router)
```

- [ ] **Step 5: Run the new router tests**

```bash
cd backend && uv run pytest tests/test_documents.py -v
```
Expected: all PASS.

- [ ] **Step 6: Run the entire backend suite**

```bash
cd backend && uv run pytest -q
```
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/prelegal_backend/documents_router.py backend/src/prelegal_backend/main.py backend/tests/test_documents.py
git commit -m "PL-7: /api/documents CRUD router"
```

---

## Task 5: Frontend `AuthForm` component (replaces `LoginForm`)

**Files:**
- Create: `frontend/src/components/auth-form.tsx`
- Modify: `frontend/src/app/login/page.tsx`
- Delete: `frontend/src/components/login-form.tsx`
- Create: `frontend/src/components/__tests__/auth-form.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Create `frontend/src/components/__tests__/auth-form.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthForm } from "@/components/auth-form";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  pushMock.mockReset();
});

describe("AuthForm — sign in mode", () => {
  it("does not show the name field and POSTs to /api/auth/login", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1, email: "a@b.co", name: "Ada" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthForm />);

    expect(screen.queryByLabelText(/^name$/i)).toBeNull();
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.co" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "hunter22-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      email: "a@b.co",
      password: "hunter22-secret",
    });
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("renders 'Invalid email or password.' on a 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ detail: "Invalid email or password." }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    render(<AuthForm />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.co" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "hunter22-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText(/invalid email or password/i),
    ).toBeDefined();
  });
});

describe("AuthForm — sign up mode", () => {
  it("toggles to sign-up: shows name field and POSTs to /api/auth/signup", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1, email: "a@b.co", name: "Ada" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthForm />);
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.co" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "hunter22-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/signup");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      email: "a@b.co",
      name: "Ada",
      password: "hunter22-secret",
    });
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("flags too-short password client-side without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthForm />);
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.co" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/at least 8 characters/i),
    ).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders the duplicate-email message on a 409", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: "An account already exists for that email.",
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    render(<AuthForm />);
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.co" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "hunter22-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/account already exists/i),
    ).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/components/__tests__/auth-form.test.tsx
```
Expected: tests fail because `@/components/auth-form` doesn't exist.

- [ ] **Step 3: Implement `AuthForm`**

Create `frontend/src/components/auth-form.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

type ApiError = { detail?: string | { msg?: string }[] };

const MIN_PASSWORD_LEN = 8;

function extractError(payload: ApiError | null, fallback: string): string {
  if (!payload?.detail) return fallback;
  if (typeof payload.detail === "string") return payload.detail;
  return payload.detail[0]?.msg ?? fallback;
}

const inputCx = cn(
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2",
  "text-sm text-slate-900 placeholder:text-slate-400 shadow-sm",
  "focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue",
);

const pillCx = (active: boolean) =>
  cn(
    "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition",
    active
      ? "bg-white text-brand-navy shadow-sm"
      : "text-brand-gray hover:text-brand-navy",
  );

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (mode === "signup" && password.length < MIN_PASSWORD_LEN) {
      setError(`Password must be at least 8 characters.`);
      return;
    }
    setSubmitting(true);
    try {
      const endpoint =
        mode === "signin" ? "/api/auth/login" : "/api/auth/signup";
      const body =
        mode === "signin"
          ? { email, password }
          : { email, name, password };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as ApiError | null;
        setError(
          extractError(
            payload,
            mode === "signin" ? "Sign-in failed." : "Sign-up failed.",
          ),
        );
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Is the backend running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Authentication mode"
        className="flex rounded-md bg-slate-100 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          className={pillCx(mode === "signin")}
          onClick={() => switchMode("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={pillCx(mode === "signup")}
          onClick={() => switchMode("signup")}
        >
          Sign up
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4"
        aria-label={mode === "signin" ? "Sign in" : "Sign up"}
      >
        {mode === "signup" ? (
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-brand-navy"
            >
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn(inputCx, "mt-1")}
              placeholder="Ada Lovelace"
            />
          </div>
        ) : null}

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-brand-navy"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(inputCx, "mt-1")}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-brand-navy"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(inputCx, "mt-1")}
            placeholder={mode === "signup" ? "At least 8 characters" : ""}
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand-purple px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-purple/90 focus:outline-none focus:ring-2 focus:ring-brand-purple/40 disabled:opacity-60"
        >
          {submitting
            ? mode === "signin"
              ? "Signing in…"
              : "Creating account…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/components/__tests__/auth-form.test.tsx
```
Expected: all PASS.

- [ ] **Step 5: Update the `/login` page with the two-column layout**

Replace `frontend/src/app/login/page.tsx`:

```tsx
import { AuthForm } from "@/components/auth-form";
import { DISCLAIMER_FULL } from "@/lib/disclaimer";

export const metadata = {
  title: "Sign in · Prelegal",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-slate-100 text-brand-navy">
      <section className="hidden md:flex flex-col justify-between bg-brand-navy text-white px-12 py-16">
        <div>
          <p className="text-2xl font-bold text-brand-yellow">Prelegal</p>
          <p className="mt-4 text-3xl font-semibold leading-tight">
            Draft legal documents in minutes, with AI.
          </p>
          <ul className="mt-10 space-y-3 text-sm text-white/85">
            <li>· 12 Common Paper templates ready out of the box</li>
            <li>· Guided AI chat fills your cover page as you talk</li>
            <li>· Instant PDF export, ready for legal review</li>
          </ul>
        </div>
        <p className="mt-12 text-xs text-white/60 max-w-xs">
          {DISCLAIMER_FULL}
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="md:hidden text-center mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">Prelegal</h1>
            <p className="mt-2 text-sm text-brand-gray">
              Draft legal documents in minutes.
            </p>
          </div>
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 p-8">
            <AuthForm />
          </div>
        </div>
      </section>
    </main>
  );
}
```

(This depends on `DISCLAIMER_FULL` from Task 6; if you run the page in isolation before Task 6 lands, swap to a literal string. The plan ordering puts Task 6 immediately after this commit so the literal swap is unnecessary if you follow order.)

- [ ] **Step 6: Delete the old `LoginForm`**

```bash
rm frontend/src/components/login-form.tsx
```

If `frontend/src/components/__tests__/login-form.test.tsx` exists, delete it too:

```bash
rm -f frontend/src/components/__tests__/login-form.test.tsx
```

- [ ] **Step 7: Hold this commit until `disclaimer.ts` lands (next task)**

Because the new login page imports `DISCLAIMER_FULL`, the import would 404 right now. Move on to Task 6 first; we'll commit Tasks 5+6 together at the end of Task 6.

---

## Task 6: Shared disclaimer module + creator banner + dashboard note

**Files:**
- Create: `frontend/src/lib/disclaimer.ts`
- Create: `frontend/src/components/draft-disclaimer-banner.tsx`
- Create: `frontend/src/components/__tests__/draft-disclaimer-banner.test.tsx`
- Modify: `frontend/src/app/dashboard/page.tsx`

- [ ] **Step 1: Create the disclaimer constants**

Create `frontend/src/lib/disclaimer.ts`:

```ts
/**
 * Centralized draft-disclaimer copy. Rendered on the creator-page banner,
 * the dashboard note, the PDF footer, and the login screen footnote.
 */

export const DISCLAIMER_FULL =
  "Prelegal generates drafts. Every document is subject to legal review before signing. This is not a substitute for legal advice.";

export const DISCLAIMER_FOOTER =
  "Draft — generated by Prelegal. Subject to legal review. Not a substitute for legal advice.";
```

- [ ] **Step 2: Write the failing banner test**

Create `frontend/src/components/__tests__/draft-disclaimer-banner.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DraftDisclaimerBanner } from "@/components/draft-disclaimer-banner";

afterEach(cleanup);

describe("DraftDisclaimerBanner", () => {
  it("renders the full disclaimer copy with a note role", () => {
    render(<DraftDisclaimerBanner />);
    const banner = screen.getByRole("note", {
      name: /draft disclaimer/i,
    });
    expect(banner).toBeDefined();
    expect(banner.textContent).toContain("Prelegal generates drafts");
    expect(banner.textContent).toContain("subject to legal review");
  });

  it("has the no-print class so it doesn't appear in browser-PDF printouts", () => {
    render(<DraftDisclaimerBanner />);
    const banner = screen.getByRole("note", {
      name: /draft disclaimer/i,
    });
    expect(banner.className).toContain("no-print");
  });
});
```

- [ ] **Step 3: Run the test to verify failure**

```bash
cd frontend && npx vitest run src/components/__tests__/draft-disclaimer-banner.test.tsx
```
Expected: fails because the banner component doesn't exist.

- [ ] **Step 4: Implement the banner**

Create `frontend/src/components/draft-disclaimer-banner.tsx`:

```tsx
import { DISCLAIMER_FULL } from "@/lib/disclaimer";

export function DraftDisclaimerBanner() {
  return (
    <div
      role="note"
      aria-label="Draft disclaimer"
      className="no-print flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
    >
      <span aria-hidden="true" className="mt-0.5 text-amber-600">
        {/* simple warning glyph; no emoji per project rules */}
        ⚠
      </span>
      <p className="text-sm">{DISCLAIMER_FULL}</p>
    </div>
  );
}
```

(The single ⚠ glyph is a typographic warning sign, not an emoji-style icon, so it doesn't violate the "no emojis" rule. If you prefer SVG, replace it with an inline `<svg>` warning triangle and update the test if the textContent assertion needs adjustment.)

- [ ] **Step 5: Run the banner test**

```bash
cd frontend && npx vitest run src/components/__tests__/draft-disclaimer-banner.test.tsx
```
Expected: PASS.

- [ ] **Step 6: Add the dashboard hero + disclaimer note**

Replace `frontend/src/app/dashboard/page.tsx`:

```tsx
import { RecommendGateway } from "@/components/recommend-gateway";
import { TemplateCard } from "@/components/template-card";
import { loadCatalog } from "@/lib/catalog";
import { DISCLAIMER_FULL } from "@/lib/disclaimer";

export default async function DashboardPage() {
  const catalog = await loadCatalog();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-brand-navy">
          Draft a document
        </h1>
        <p className="text-sm text-brand-gray max-w-2xl">
          Pick a template, chat with the AI to fill it in, and download a PDF.
          Or describe what you need and we&apos;ll recommend the right one.
        </p>
      </header>

      <RecommendGateway />

      <p
        role="note"
        aria-label="Draft disclaimer"
        className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900"
      >
        {DISCLAIMER_FULL}
      </p>

      <section
        aria-label="Available templates"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {catalog.templates.map((template) => (
          <TemplateCard key={template.filename} template={template} />
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 7: Run the full frontend suite to confirm no regressions**

```bash
cd frontend && npx vitest run
```
Expected: all tests pass.

- [ ] **Step 8: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no output (clean).

- [ ] **Step 9: Commit Tasks 5 + 6 together**

```bash
git add frontend/src/components/auth-form.tsx \
        frontend/src/components/__tests__/auth-form.test.tsx \
        frontend/src/app/login/page.tsx \
        frontend/src/lib/disclaimer.ts \
        frontend/src/components/draft-disclaimer-banner.tsx \
        frontend/src/components/__tests__/draft-disclaimer-banner.test.tsx \
        frontend/src/app/dashboard/page.tsx
git rm frontend/src/components/login-form.tsx
git rm -f frontend/src/components/__tests__/login-form.test.tsx 2>/dev/null || true
git commit -m "PL-7: AuthForm + draft disclaimer + dashboard hero"
```

---

## Task 7: PDF footers on Mutual NDA + generic documents

**Files:**
- Modify: `frontend/src/lib/templates/mutual-nda/pdf-document.tsx`
- Modify: `frontend/src/lib/templates/generic/pdf-document.tsx`
- Modify: `frontend/src/lib/__tests__/nda-pdf.test.tsx` (assertion that the footer appears in the rendered PDF text)

- [ ] **Step 1: Update the existing NDA PDF test to assert the footer**

Open `frontend/src/lib/__tests__/nda-pdf.test.tsx`. Find the test `"includes the document title and the cover-page field labels"` and add a parallel new test below it:

```tsx
  it("includes the draft-disclaimer footer on every page", async () => {
    const text = await renderPdfText(defaultNdaData());
    expect(text).toContain("Draft — generated by Prelegal");
  });
```

- [ ] **Step 2: Run the new test (expect failure)**

```bash
cd frontend && npx vitest run src/lib/__tests__/nda-pdf.test.tsx -t "draft-disclaimer footer"
```
Expected: FAIL — the footer string isn't in the PDF yet.

- [ ] **Step 3: Add a fixed footer to the NDA PDF**

In `frontend/src/lib/templates/mutual-nda/pdf-document.tsx`:

1. Add a new style entry to the `styles = StyleSheet.create({...})` block:

```ts
  footer: {
    position: "absolute",
    bottom: 28,
    left: 56,
    right: 56,
    textAlign: "center",
    fontSize: 8,
    color: palette.faint,
  },
```

2. At the top of the file, add (if not already):

```ts
import { DISCLAIMER_FOOTER } from "../../disclaimer";
```

3. Inside the `<Page size="LETTER" style={styles.page} wrap>` element — just before the closing `</Page>` — add:

```tsx
      <Text fixed style={styles.footer}>
        {DISCLAIMER_FOOTER}
      </Text>
```

- [ ] **Step 4: Mirror the change in the generic PDF**

Apply the same three sub-edits to `frontend/src/lib/templates/generic/pdf-document.tsx` (the generic doc has its own `styles` block and its own `<Page>` element).

- [ ] **Step 5: Run PDF tests**

```bash
cd frontend && npx vitest run src/lib/__tests__/nda-pdf.test.tsx
```
Expected: all pass, including the new footer assertion.

- [ ] **Step 6: Run the full frontend suite**

```bash
cd frontend && npx vitest run
```
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/templates/mutual-nda/pdf-document.tsx \
        frontend/src/lib/templates/generic/pdf-document.tsx \
        frontend/src/lib/__tests__/nda-pdf.test.tsx
git commit -m "PL-7: draft disclaimer footer on every PDF page"
```

---

## Task 8: Frontend documents client

**Files:**
- Create: `frontend/src/lib/templates/documents-client.ts`
- Create: `frontend/src/lib/templates/__tests__/documents-client.test.ts`

- [ ] **Step 1: Write failing client tests**

Create `frontend/src/lib/templates/__tests__/documents-client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDocument,
  deleteDocument,
  DocumentsClientError,
  getDocument,
  listDocuments,
  updateDocument,
} from "@/lib/templates/documents-client";

afterEach(() => vi.restoreAllMocks());

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("documents-client", () => {
  it("listDocuments hits /api/documents and forwards the slug query", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okJson([]))
      .mockResolvedValueOnce(okJson([]));
    vi.stubGlobal("fetch", fetchMock);
    await listDocuments();
    await listDocuments("mutual-nda");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/documents");
    expect(fetchMock.mock.calls[1][0]).toBe(
      "/api/documents?slug=mutual-nda",
    );
  });

  it("createDocument POSTs and returns the new doc", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okJson(
        {
          id: 1,
          slug: "mutual-nda",
          title: "Acme ↔ Globex",
          fields: { purpose: "x" },
          updatedAt: "2026-05-24 00:00:00",
        },
        201,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const doc = await createDocument({
      slug: "mutual-nda",
      fields: { purpose: "x" },
    });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/documents");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      slug: "mutual-nda",
      fields: { purpose: "x" },
    });
    expect(doc.id).toBe(1);
  });

  it("updateDocument PATCHes the resource", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okJson({
        id: 1,
        slug: "mutual-nda",
        title: "x",
        fields: {},
        updatedAt: "2026-05-24 00:00:00",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await updateDocument(1, { fields: { purpose: "y" }, title: "x" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/documents/1");
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      fields: { purpose: "y" },
      title: "x",
    });
  });

  it("getDocument GETs by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okJson({
        id: 1,
        slug: "mutual-nda",
        title: "x",
        fields: {},
        updatedAt: "now",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await getDocument(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/documents/1");
  });

  it("deleteDocument DELETEs by id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await deleteDocument(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("DELETE");
  });

  it("throws DocumentsClientError on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(okJson({ detail: "Not found" }, 404)),
    );
    await expect(getDocument(99)).rejects.toBeInstanceOf(
      DocumentsClientError,
    );
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**

```bash
cd frontend && npx vitest run src/lib/templates/__tests__/documents-client.test.ts
```
Expected: fail (module not found).

- [ ] **Step 3: Implement the client**

Create `frontend/src/lib/templates/documents-client.ts`:

```ts
export type DocumentSummary = {
  id: number;
  slug: string;
  title: string;
  updatedAt: string;
};

export type DocumentDetail<Fields = unknown> = {
  id: number;
  slug: string;
  title: string;
  fields: Fields;
  updatedAt: string;
};

export class DocumentsClientError extends Error {
  readonly name = "DocumentsClientError";
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`Documents request failed (${status}): ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

async function parseError(response: Response): Promise<never> {
  let detail = response.statusText || "Request failed";
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") detail = body.detail;
  } catch {
    // statusText fallback
  }
  throw new DocumentsClientError(response.status, detail);
}

export async function listDocuments(
  slug?: string,
): Promise<DocumentSummary[]> {
  const url = slug
    ? `/api/documents?slug=${encodeURIComponent(slug)}`
    : "/api/documents";
  const response = await fetch(url, {
    credentials: "include",
  });
  if (!response.ok) await parseError(response);
  return (await response.json()) as DocumentSummary[];
}

export async function getDocument<Fields = unknown>(
  id: number,
): Promise<DocumentDetail<Fields>> {
  const response = await fetch(`/api/documents/${id}`, {
    credentials: "include",
  });
  if (!response.ok) await parseError(response);
  return (await response.json()) as DocumentDetail<Fields>;
}

export async function createDocument<Fields>(args: {
  slug: string;
  fields: Fields;
  title?: string;
}): Promise<DocumentDetail<Fields>> {
  const response = await fetch("/api/documents", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!response.ok) await parseError(response);
  return (await response.json()) as DocumentDetail<Fields>;
}

export async function updateDocument<Fields>(
  id: number,
  args: { fields?: Fields; title?: string },
): Promise<DocumentDetail<Fields>> {
  const response = await fetch(`/api/documents/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!response.ok) await parseError(response);
  return (await response.json()) as DocumentDetail<Fields>;
}

export async function deleteDocument(id: number): Promise<void> {
  const response = await fetch(`/api/documents/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) await parseError(response);
}
```

- [ ] **Step 4: Run client tests**

```bash
cd frontend && npx vitest run src/lib/templates/__tests__/documents-client.test.ts
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/templates/documents-client.ts frontend/src/lib/templates/__tests__/documents-client.test.ts
git commit -m "PL-7: documents-client (typed REST wrapper)"
```

---

## Task 9: `SavedDraftsPanel` component

**Files:**
- Create: `frontend/src/components/saved-drafts-panel.tsx`
- Create: `frontend/src/components/__tests__/saved-drafts-panel.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/__tests__/saved-drafts-panel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SavedDraftsPanel } from "@/components/saved-drafts-panel";
import * as documentsClient from "@/lib/templates/documents-client";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SavedDraftsPanel", () => {
  it("renders the empty state when there are no drafts", async () => {
    vi.spyOn(documentsClient, "listDocuments").mockResolvedValue([]);
    render(
      <SavedDraftsPanel
        slug="mutual-nda"
        activeDocumentId={null}
        onResume={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );
    await waitFor(() => expect(documentsClient.listDocuments).toHaveBeenCalled());
    expect(
      await screen.findByText(/no saved drafts of this template yet/i),
    ).toBeDefined();
  });

  it("lists saved drafts and invokes onResume when Resume is clicked", async () => {
    vi.spyOn(documentsClient, "listDocuments").mockResolvedValue([
      { id: 5, slug: "mutual-nda", title: "Acme ↔ Globex", updatedAt: "2026-05-24 00:00:00" },
    ]);
    const onResume = vi.fn();
    render(
      <SavedDraftsPanel
        slug="mutual-nda"
        activeDocumentId={null}
        onResume={onResume}
        onDeleted={vi.fn()}
      />,
    );
    expect(await screen.findByText("Acme ↔ Globex")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /resume/i }));
    expect(onResume).toHaveBeenCalledWith(5);
  });

  it("deletes a draft after the user confirms", async () => {
    vi.spyOn(documentsClient, "listDocuments").mockResolvedValueOnce([
      { id: 7, slug: "mutual-nda", title: "Draft 1", updatedAt: "2026-05-24 00:00:00" },
    ]);
    const deleteSpy = vi.spyOn(documentsClient, "deleteDocument").mockResolvedValue();
    // After deletion the panel refetches → return empty list.
    vi.mocked(documentsClient.listDocuments).mockResolvedValueOnce([]);
    const onDeleted = vi.fn();

    render(
      <SavedDraftsPanel
        slug="mutual-nda"
        activeDocumentId={null}
        onResume={vi.fn()}
        onDeleted={onDeleted}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /delete/i }));
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith(7));
    expect(onDeleted).toHaveBeenCalledWith(7);
  });

  it("surfaces an alert when the list call fails", async () => {
    vi.spyOn(documentsClient, "listDocuments").mockRejectedValue(
      new documentsClient.DocumentsClientError(500, "boom"),
    );
    render(
      <SavedDraftsPanel
        slug="mutual-nda"
        activeDocumentId={null}
        onResume={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );
    expect(await screen.findByRole("alert")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the tests (expect failure)**

```bash
cd frontend && npx vitest run src/components/__tests__/saved-drafts-panel.test.tsx
```
Expected: fail (module not found).

- [ ] **Step 3: Implement the panel**

Create `frontend/src/components/saved-drafts-panel.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteDocument,
  DocumentsClientError,
  listDocuments,
  type DocumentSummary,
} from "@/lib/templates/documents-client";

type Props = {
  slug: string;
  activeDocumentId: number | null;
  onResume: (documentId: number) => void;
  onDeleted: (documentId: number) => void;
};

type DeleteState =
  | { kind: "idle" }
  | { kind: "confirming"; id: number }
  | { kind: "deleting"; id: number };

const relative = (iso: string): string => {
  const now = Date.now();
  const then = new Date(iso.replace(" ", "T") + "Z").getTime();
  const diff = Math.max(0, now - then);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)} min ago`;
  if (diff < day) return `${Math.floor(diff / hour)} h ago`;
  return `${Math.floor(diff / day)} d ago`;
};

export function SavedDraftsPanel({
  slug,
  activeDocumentId,
  onResume,
  onDeleted,
}: Props) {
  const [drafts, setDrafts] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>({ kind: "idle" });

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const list = await listDocuments(slug);
      setDrafts(list);
    } catch (err) {
      const detail =
        err instanceof DocumentsClientError
          ? err.detail
          : "Could not load saved drafts.";
      setError(detail);
    }
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleConfirmDelete = useCallback(
    async (id: number) => {
      setDeleteState({ kind: "deleting", id });
      try {
        await deleteDocument(id);
        onDeleted(id);
        await refresh();
      } catch (err) {
        const detail =
          err instanceof DocumentsClientError
            ? err.detail
            : "Could not delete that draft.";
        setError(detail);
      } finally {
        setDeleteState({ kind: "idle" });
      }
    },
    [onDeleted, refresh],
  );

  return (
    <section
      aria-label="Saved drafts"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-navy">Saved drafts</h2>
        {drafts && drafts.length > 0 ? (
          <span className="text-xs text-brand-gray">
            {drafts.length} {drafts.length === 1 ? "draft" : "drafts"}
          </span>
        ) : null}
      </header>

      {error ? (
        <p role="alert" className="mt-3 text-xs text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-3 space-y-2">
        {drafts === null ? (
          <p className="text-xs text-brand-gray">Loading…</p>
        ) : drafts.length === 0 ? (
          <p className="text-xs text-brand-gray">
            No saved drafts of this template yet.
          </p>
        ) : (
          drafts.map((draft) => {
            const isActive = draft.id === activeDocumentId;
            const isConfirming =
              deleteState.kind === "confirming" && deleteState.id === draft.id;
            const isDeleting =
              deleteState.kind === "deleting" && deleteState.id === draft.id;
            return (
              <div
                key={draft.id}
                className="rounded-md border border-slate-200 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brand-navy">
                      {draft.title}
                      {isActive ? (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-brand-blue">
                          editing
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-brand-gray">
                      Last saved {relative(draft.updatedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onResume(draft.id)}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-brand-navy hover:bg-slate-50"
                    >
                      Resume
                    </button>
                    {isConfirming ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setDeleteState({ kind: "idle" })}
                          className="rounded-md px-2 py-1 text-xs text-brand-gray hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmDelete(draft.id)}
                          disabled={isDeleting}
                          className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-60"
                        >
                          Confirm
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteState({ kind: "confirming", id: draft.id })
                        }
                        className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the panel tests**

```bash
cd frontend && npx vitest run src/components/__tests__/saved-drafts-panel.test.tsx
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/saved-drafts-panel.tsx frontend/src/components/__tests__/saved-drafts-panel.test.tsx
git commit -m "PL-7: SavedDraftsPanel component"
```

---

## Task 10: Wire Save / Resume / Drafts panel into `TemplateChatApp`

**Files:**
- Modify: `frontend/src/components/template-chat-app.tsx` (the whole component shape changes; rewrite carefully)

- [ ] **Step 1: Rewrite `TemplateChatApp`**

Replace `frontend/src/components/template-chat-app.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { NdaChat, type ChatStatus } from "./nda-chat";
import { TemplateEditPanel } from "./template-edit-panel";
import { DraftDisclaimerBanner } from "./draft-disclaimer-banner";
import { SavedDraftsPanel } from "./saved-drafts-panel";
import type { Block } from "@/lib/markdown-blocks";
import type { ChatMessage } from "@/lib/templates/chat-types";
import { ChatError, sendChatTurn } from "@/lib/templates/chat-client";
import {
  createDocument,
  DocumentsClientError,
  getDocument,
  updateDocument,
} from "@/lib/templates/documents-client";
import type { TemplateSpec } from "@/lib/templates/types";

type Props<Data> = {
  spec: TemplateSpec<Data>;
  standardTerms: string;
  standardTermsBlocks: Block[];
};

type DownloadStatus = "idle" | "generating" | "error";
type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; detail: string };

const MAX_MESSAGES = 60;

const slugify = (s: string): string =>
  s.trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const capMessages = (msgs: ChatMessage[]): ChatMessage[] =>
  msgs.length <= MAX_MESSAGES ? msgs : msgs.slice(msgs.length - MAX_MESSAGES);

const buildPdfFileName = <Data,>(spec: TemplateSpec<Data>, data: Data): string => {
  const suffix = spec.buildPdfNameSuffix(data).map(slugify).filter(Boolean);
  return suffix.length > 0
    ? `${spec.pdfFilenamePrefix}-${suffix.join("-")}.pdf`
    : `${spec.pdfFilenamePrefix}.pdf`;
};

export function TemplateChatApp<Data>({
  spec,
  standardTerms,
  standardTermsBlocks,
}: Props<Data>) {
  const initialGreeting = useMemo<ChatMessage>(
    () => ({ role: "assistant", content: spec.greeting }),
    [spec.greeting],
  );

  const [messages, setMessages] = useState<ChatMessage[]>([initialGreeting]);
  const [fields, setFields] = useState<Data>(() => spec.defaultData());
  const [chatStatus, setChatStatus] = useState<ChatStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>("idle");

  const [currentDocumentId, setCurrentDocumentId] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle" });
  const [resumeNote, setResumeNote] = useState<string | null>(null);

  // Tick the "Saved N min ago" label every 30s while idle/saved.
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    if (saveStatus.kind !== "saved") return;
    const interval = window.setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => window.clearInterval(interval);
  }, [saveStatus.kind]);

  const handleSend = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = { role: "user", content };
      const nextMessages = capMessages([...messages, userMessage]);
      setMessages(nextMessages);
      setChatStatus("sending");
      setErrorMessage(null);
      try {
        const result = await sendChatTurn<Data>(
          spec.slug,
          nextMessages,
          fields,
        );
        setMessages(
          capMessages([
            ...nextMessages,
            { role: "assistant", content: result.assistantMessage },
          ]),
        );
        setFields(result.mergedFields);
        setIsComplete(result.isComplete);
        setChatStatus("idle");
      } catch (err) {
        const detail =
          err instanceof ChatError ? err.detail : "Couldn't reach the AI.";
        setErrorMessage(detail);
        setChatStatus("error");
      }
    },
    [messages, fields, spec.slug],
  );

  const resetForNewDraft = useCallback(() => {
    setMessages([initialGreeting]);
    setFields(spec.defaultData());
    setChatStatus("idle");
    setErrorMessage(null);
    setIsComplete(false);
    setCurrentDocumentId(null);
    setSaveStatus({ kind: "idle" });
  }, [initialGreeting, spec]);

  const handleSave = useCallback(async () => {
    setSaveStatus({ kind: "saving" });
    try {
      const saved =
        currentDocumentId === null
          ? await createDocument<Data>({ slug: spec.slug, fields })
          : await updateDocument<Data>(currentDocumentId, { fields });
      setCurrentDocumentId(saved.id);
      setSaveStatus({ kind: "saved", at: Date.now() });
    } catch (err) {
      const detail =
        err instanceof DocumentsClientError
          ? err.detail
          : "Could not save.";
      setSaveStatus({ kind: "error", detail });
    }
  }, [currentDocumentId, spec.slug, fields]);

  const handleResume = useCallback(
    async (documentId: number) => {
      setResumeNote(null);
      try {
        const doc = await getDocument<Data>(documentId);
        setFields(doc.fields);
        setCurrentDocumentId(doc.id);
        setMessages([initialGreeting]);
        setChatStatus("idle");
        setErrorMessage(null);
        setIsComplete(false);
        setSaveStatus({ kind: "saved", at: Date.now() });
        setResumeNote(
          `Loaded "${doc.title}". Chat starts fresh; document fields are restored.`,
        );
        window.setTimeout(() => setResumeNote(null), 5000);
      } catch (err) {
        const detail =
          err instanceof DocumentsClientError
            ? err.detail
            : "Could not load that draft.";
        setResumeNote(`Could not load draft: ${detail}`);
      }
    },
    [initialGreeting],
  );

  const handleDeleted = useCallback(
    (documentId: number) => {
      if (documentId === currentDocumentId) {
        resetForNewDraft();
      }
    },
    [currentDocumentId, resetForNewDraft],
  );

  const handleDownload = useCallback(async () => {
    setDownloadStatus("generating");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const blob = await pdf(
        <>
          {spec.PdfDocument({ data: fields, standardTermsBlocks })}
        </>,
      ).toBlob();
      triggerBlobDownload(blob, buildPdfFileName(spec, fields));
      setDownloadStatus("idle");
    } catch (err) {
      console.error(`Failed to generate PDF for ${spec.slug}`, err);
      setDownloadStatus("error");
    }
  }, [fields, spec, standardTermsBlocks]);

  const saveLabel = (() => {
    switch (saveStatus.kind) {
      case "saving":
        return "Saving…";
      case "saved":
        // We rely on nowTick to force re-render every 30s.
        void nowTick;
        return currentDocumentId === null ? "Save draft" : "Saved";
      default:
        return currentDocumentId === null ? "Save draft" : "Update saved";
    }
  })();

  return (
    <div className="space-y-8">
      <DraftDisclaimerBanner />

      <header className="no-print flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-navy">
            {spec.pageTitle}
          </h1>
          <p className="mt-1 text-sm text-brand-gray">{spec.pageSubtitle}</p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <div className="flex items-center gap-3">
            {isComplete ? (
              <span className="text-xs font-medium text-emerald-700">
                ✓ Ready to download
              </span>
            ) : null}
            <button
              type="button"
              onClick={handleSave}
              disabled={saveStatus.kind === "saving"}
              data-testid="save-draft"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-brand-navy hover:bg-slate-50 disabled:opacity-60"
            >
              {saveLabel}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloadStatus === "generating"}
              data-testid="download-pdf"
              className="inline-flex items-center gap-2 rounded-md bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:bg-brand-purple/90 focus:outline-none focus:ring-2 focus:ring-brand-purple/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloadStatus === "generating" ? "Generating…" : "Download PDF"}
            </button>
          </div>
          {saveStatus.kind === "error" ? (
            <p className="text-xs text-red-600" role="alert">
              {saveStatus.detail}
            </p>
          ) : null}
          {downloadStatus === "error" ? (
            <p className="text-xs text-red-600" role="alert">
              Could not generate the PDF. Check the console and try again.
            </p>
          ) : null}
        </div>
      </header>

      {resumeNote ? (
        <p
          aria-live="polite"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          {resumeNote}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <section className="no-print space-y-6">
          <SavedDraftsPanel
            slug={spec.slug}
            activeDocumentId={currentDocumentId}
            onResume={handleResume}
            onDeleted={handleDeleted}
          />
          <NdaChat
            messages={messages}
            status={chatStatus}
            errorMessage={errorMessage}
            onSend={handleSend}
            onReset={resetForNewDraft}
          />
        </section>
        <section>
          {spec.PreviewComponent({ value: fields, standardTerms })}
        </section>
      </div>

      <section className="no-print">
        <TemplateEditPanel>
          {spec.FormComponent({ value: fields, onChange: setFields })}
        </TemplateEditPanel>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Run the full frontend suite (catches regressions in NDA / template tests that mount this)**

```bash
cd frontend && npx vitest run
```
Expected: all pass.

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/template-chat-app.tsx
git commit -m "PL-7: save + resume drafts in generic creator app"
```

---

## Task 11: Mirror Save / Resume in `NdaChatApp`

**Files:**
- Modify: `frontend/src/components/nda-chat-app.tsx`
- Modify: `frontend/src/components/__tests__/nda-chat-app.test.tsx` — add the `documents-client` mock and a save-button smoke test

- [ ] **Step 1: Update the existing NDA test file to mock documents-client**

In `frontend/src/components/__tests__/nda-chat-app.test.tsx`, add this near the top (after the chat-client import):

```tsx
import * as documentsClient from "@/lib/templates/documents-client";
```

And inside `beforeEach` or near the existing `afterEach`, add a default mock so tests that don't care about save/resume still work:

```tsx
beforeEach(() => {
  vi.spyOn(documentsClient, "listDocuments").mockResolvedValue([]);
});
```

(Import `beforeEach` from `vitest` if it isn't already.)

Then add one new test at the bottom of the existing `describe("NdaChatApp")` block:

```tsx
it("calls createDocument when Save draft is clicked the first time", async () => {
  vi.spyOn(chatClient, "sendChatTurn").mockResolvedValue({
    assistantMessage: "ok",
    mergedFields: defaultNdaData(),
    isComplete: false,
  });
  const createSpy = vi
    .spyOn(documentsClient, "createDocument")
    .mockResolvedValue({
      id: 42,
      slug: "mutual-nda",
      title: "Acme ↔ Globex",
      fields: defaultNdaData(),
      updatedAt: "2026-05-24 00:00:00",
    });

  render(
    <NdaChatApp
      standardTerms={STANDARD_TERMS}
      standardTermsBlocks={STANDARD_TERMS_BLOCKS}
    />,
  );

  fireEvent.click(screen.getByTestId("save-draft"));

  await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
  expect(createSpy.mock.calls[0][0].slug).toBe("mutual-nda");
});
```

- [ ] **Step 2: Run the test (expect failure)**

```bash
cd frontend && npx vitest run src/components/__tests__/nda-chat-app.test.tsx
```
Expected: the new test fails because `nda-chat-app.tsx` has no save button.

- [ ] **Step 3: Update `nda-chat-app.tsx`**

Replace `frontend/src/components/nda-chat-app.tsx`. The structure mirrors `TemplateChatApp` but keeps the bespoke `NdaPreview`, `NdaEditPanel`, and PDF document. Apply these changes:

1. Add the same imports as in Task 10's `TemplateChatApp`:
   ```tsx
   import { DraftDisclaimerBanner } from "./draft-disclaimer-banner";
   import { SavedDraftsPanel } from "./saved-drafts-panel";
   import {
     createDocument,
     DocumentsClientError,
     getDocument,
     updateDocument,
   } from "@/lib/templates/documents-client";
   ```

2. Add the `currentDocumentId`, `saveStatus`, and `resumeNote` state variables (and the `useEffect` ticker), copying the patterns from Task 10.

3. Add `handleSave`, `handleResume`, and `handleDeleted` callbacks bound to `slug="mutual-nda"` and `NdaData` as the `Data` type, mirroring Task 10. (Use `<NdaData>` as the generic argument to `createDocument`, `updateDocument`, and `getDocument`.)

4. Replace the `handleReset` body to also reset `currentDocumentId` and `saveStatus`.

5. In the returned JSX:
   - Add `<DraftDisclaimerBanner />` as the first child of the wrapping div (above the header).
   - Insert the `<SavedDraftsPanel slug="mutual-nda" activeDocumentId={currentDocumentId} onResume={handleResume} onDeleted={handleDeleted} />` above `<NdaChat ... />` inside the chat sidebar section (`<section className="no-print">` becomes `<section className="no-print space-y-6">`).
   - Add a `<button data-testid="save-draft" onClick={handleSave} ...>` next to the existing Download PDF button, styled like Task 10's save button.
   - Render the `resumeNote` div under the header, same as Task 10.

(Do this surgery directly in the file rather than copy-pasting from Task 10's listing because the NDA app's JSX has its own `NdaPreview`, `NdaEditPanel`, and `import("@/lib/templates/mutual-nda/pdf-document")` dynamic import — keep all of those unchanged.)

- [ ] **Step 4: Run the NDA tests**

```bash
cd frontend && npx vitest run src/components/__tests__/nda-chat-app.test.tsx
```
Expected: all PASS (the new save-button test + the existing 4).

- [ ] **Step 5: Run the full frontend suite**

```bash
cd frontend && npx vitest run
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/nda-chat-app.tsx frontend/src/components/__tests__/nda-chat-app.test.tsx
git commit -m "PL-7: save + resume drafts in Mutual NDA creator"
```

---

## Task 12: `UserMenu` component (replaces standalone logout button)

**Files:**
- Create: `frontend/src/components/user-menu.tsx`
- Create: `frontend/src/components/__tests__/user-menu.test.tsx`
- Modify: `frontend/src/components/shell/top-bar.tsx`
- Delete: `frontend/src/components/logout-button.tsx`

- [ ] **Step 1: Write the failing UserMenu test**

Create `frontend/src/components/__tests__/user-menu.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UserMenu } from "@/components/user-menu";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  pushMock.mockReset();
});

describe("UserMenu", () => {
  const user = { id: 1, email: "ada@example.com", name: "Ada Lovelace" };

  it("shows the avatar initial and opens the dropdown on click", () => {
    render(<UserMenu user={user} />);
    expect(screen.getByLabelText(/account menu/i).textContent).toContain("A");
    fireEvent.click(screen.getByLabelText(/account menu/i));
    expect(screen.getByText("Ada Lovelace")).toBeDefined();
    expect(screen.getByText("ada@example.com")).toBeDefined();
  });

  it("POSTs to /api/auth/logout and routes to /login on Sign out", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<UserMenu user={user} />);
    fireEvent.click(screen.getByLabelText(/account menu/i));
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST" })),
    );
    expect(pushMock).toHaveBeenCalledWith("/login");
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**

```bash
cd frontend && npx vitest run src/components/__tests__/user-menu.test.tsx
```
Expected: fails — module not found.

- [ ] **Step 3: Implement `UserMenu`**

Create `frontend/src/components/user-menu.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/api";

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  return parts[0][0].toUpperCase();
};

export function UserMenu({ user }: { user: User }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full",
          "bg-brand-purple text-white text-sm font-semibold",
          "focus:outline-none focus:ring-2 focus:ring-brand-purple/40",
        )}
      >
        {initials(user.name)}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded-md border border-slate-200 bg-white p-3 shadow-md"
        >
          <p
            className="text-sm font-medium text-brand-navy"
            data-testid="user-name"
          >
            {user.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-brand-gray">
            {user.email}
          </p>
          <hr className="my-2 border-slate-200" />
          <button
            type="button"
            onClick={signOut}
            disabled={busy}
            className="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-brand-navy hover:bg-slate-50 disabled:opacity-60"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the UserMenu tests**

```bash
cd frontend && npx vitest run src/components/__tests__/user-menu.test.tsx
```
Expected: all PASS.

- [ ] **Step 5: Update the top bar**

Replace `frontend/src/components/shell/top-bar.tsx`:

```tsx
import { UserMenu } from "@/components/user-menu";
import type { User } from "@/lib/api";

export function TopBar({ user }: { user: User }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-brand-navy">Prelegal</span>
      </div>
      <UserMenu user={user} />
    </header>
  );
}
```

- [ ] **Step 6: Delete the old logout button**

```bash
rm frontend/src/components/logout-button.tsx
```

- [ ] **Step 7: Run the full frontend suite**

```bash
cd frontend && npx vitest run
```
Expected: all PASS. If any other test imports `logout-button.tsx`, update or delete it.

- [ ] **Step 8: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/user-menu.tsx \
        frontend/src/components/__tests__/user-menu.test.tsx \
        frontend/src/components/shell/top-bar.tsx
git rm frontend/src/components/logout-button.tsx
git commit -m "PL-7: avatar-based UserMenu in top bar"
```

---

## Task 13: Update `frontend/CLAUDE.md`

**Files:**
- Modify: `frontend/CLAUDE.md`

- [ ] **Step 1: Replace the "Current state" paragraph (lines 11-20)**

Open `frontend/CLAUDE.md`. Replace:

```
Current state (post-PL-6): fake-auth login (any email + name signs you in — no real
authentication yet)…
```

with:

```
Current state (post-PL-7): a Next.js shell with a sidebar + top bar (avatar-based
user menu), real email + password authentication (bcrypt-hashed via passlib), a
dashboard that lists all 12 catalog templates with a "Recommend a template" gateway
and a draft disclaimer, and a creator route per template that drives a chat-driven
fill-in, live preview, PDF download, and per-user saved drafts (resume / delete).
The Mutual NDA uses bespoke schema/form/preview/PDF components; the other 11
templates share a generic field-manifest-driven scaffold. Every PDF page carries a
"Draft — generated by Prelegal" footer.
```

- [ ] **Step 2: Replace the "Implementation status" bullets (lines 66-end)**

Append the following bullets to the existing list (and remove any bullet contradicted by the new copy):

```
- Authentication: real email + password sign-in / sign-up via `POST /api/auth/login` and `POST /api/auth/signup`. Passwords are bcrypt-hashed via passlib. The `/login` route (`src/app/login/page.tsx`) renders a two-column SaaS layout with `<AuthForm />` (`src/components/auth-form.tsx`) that toggles between sign-in and sign-up modes.
- Document persistence: each creator page surfaces a `<SavedDraftsPanel />` (`src/components/saved-drafts-panel.tsx`) above the chat sidebar. A **Save draft** button writes the merged document to `/api/documents` (POST first time, PATCH thereafter — see `backend/src/prelegal_backend/documents.py` + `documents_router.py`). Resume reloads the saved fields and resets the chat; delete confirms inline and removes the row. Chat history is not persisted.
- Draft disclaimer: shared copy in `src/lib/disclaimer.ts`. Rendered as `<DraftDisclaimerBanner />` at the top of every creator page, as a slim amber row on `/dashboard`, as a footnote on the login screen, and as a fixed footer on every PDF page (both `mutual-nda/pdf-document.tsx` and `generic/pdf-document.tsx`).
- Top bar `<UserMenu />` (`src/components/user-menu.tsx`) shows the user's avatar initial; the dropdown shows name + email and a Sign out action that POSTs to `/api/auth/logout`.
```

- [ ] **Step 3: Commit**

```bash
git add frontend/CLAUDE.md
git commit -m "PL-7: refresh CLAUDE.md for multi-user + polish state"
```

---

## Task 14: Final verification

- [ ] **Step 1: Run the full backend suite**

```bash
cd backend && uv run pytest -q
```
Expected: all PASS.

- [ ] **Step 2: Run the full frontend suite**

```bash
cd frontend && npx vitest run
```
Expected: all PASS.

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Lint**

```bash
cd frontend && npm run lint
```
Expected: no errors. Fix any warnings introduced by the new components.

- [ ] **Step 5: Smoke-test the stack**

```bash
bash scripts/start-mac.sh
```

Wait for both containers Up, then exercise via curl:

```bash
curl -s http://localhost:8000/api/health
rm -f /tmp/pl7-cookies.txt
# Sign up
curl -sc /tmp/pl7-cookies.txt -X POST http://localhost:8000/api/auth/signup \
  -H 'content-type: application/json' \
  -d '{"email":"smoke@example.com","name":"Smoke Tester","password":"hunter22-secret"}'
# Save a draft
curl -sb /tmp/pl7-cookies.txt -X POST http://localhost:8000/api/documents \
  -H 'content-type: application/json' \
  -d '{"slug":"mutual-nda","fields":{"purpose":"Test","effectiveDate":"2026-05-24","mndaTerm":{"kind":"years","years":1},"confidentialityTerm":{"kind":"years","years":1},"governingLaw":"","jurisdiction":"","modifications":"","party1":{"name":"","title":"","company":"Acme","noticeAddress":"","date":"2026-05-24"},"party2":{"name":"","title":"","company":"Globex","noticeAddress":"","date":"2026-05-24"}}}'
# List drafts
curl -sb /tmp/pl7-cookies.txt 'http://localhost:8000/api/documents?slug=mutual-nda'
# Logout
curl -sb /tmp/pl7-cookies.txt -X POST http://localhost:8000/api/auth/logout
```

Expected: signup returns 201 + cookie; create returns 201 + JSON with `title` = `"Acme ↔ Globex"`; list returns one entry; logout returns 204.

Also fetch the rendered pages:

```bash
curl -s http://localhost:3000/login | grep -q "Draft legal documents" && echo "login OK"
curl -sb /tmp/pl7-cookies.txt http://localhost:3000/dashboard | grep -q "Draft a document" && echo "dashboard OK"
```

- [ ] **Step 6: Stop the stack**

```bash
bash scripts/stop-mac.sh
```

- [ ] **Step 7: Open the PR**

```bash
git push -u origin PL-7
gh pr create --title "PL-7: support multiple users and final polish" --body "$(cat <<'EOF'
## Summary
- Real email + password sign-up / sign-in (bcrypt hashing via `passlib`); removes the fake-auth login.
- Per-user document persistence: explicit Save / Resume / Delete UI on every creator page, backed by a new `/api/documents` CRUD router.
- Draft disclaimer rendered on the creator page, dashboard, login screen, and every PDF page.
- Targeted SaaS polish: two-column login layout, dashboard hero, avatar `<UserMenu />` with sign-out, tightened creator header.
- `frontend/CLAUDE.md` refreshed for post-PL-7 reality.

## Test plan
- [x] `uv run pytest -q` — backend unit + integration tests pass (users / auth / documents / generic templates / recommend).
- [x] `npx vitest run` — frontend unit tests pass (AuthForm, SavedDraftsPanel, DraftDisclaimerBanner, UserMenu, documents-client, plus all PL-6 tests still green).
- [x] `npx tsc --noEmit` clean.
- [x] `npm run lint` clean.
- [ ] Manual smoke: sign up, save a draft from the Mutual NDA creator, log out, log back in, resume the draft, download the PDF, and confirm the footer disclaimer is present on every page.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 8: Wait for review.** Do not merge until the user confirms.

---

## Self-review checklist (for the executor)

- [ ] Every "TODO/TBD/placeholder" search returns nothing in this plan.
- [ ] Types and function signatures match across tasks (`User`, `Document`, `DocumentSummary`, `EmailAlreadyRegistered`, `DocumentNotFound`, `DocumentsClientError`).
- [ ] Every spec section is covered:
  - Auth: Task 1 (hashing), Task 2 (endpoints), Task 5 (UI).
  - Document persistence: Task 3 (model + helpers), Task 4 (router), Task 8 (client), Task 9 (panel), Task 10 (generic wiring), Task 11 (NDA wiring).
  - Disclaimer: Task 6 (banner + dashboard), Task 7 (PDF footer), Task 5 (login footnote).
  - Polish: Task 5 (login two-column), Task 6 (dashboard hero), Task 12 (UserMenu).
  - CLAUDE.md: Task 13.
  - Tests: every task adds or updates tests; Task 14 runs the full sweep + smoke.
