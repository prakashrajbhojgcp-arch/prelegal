from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from prelegal_backend import db as db_module
from prelegal_backend.main import create_app


@pytest.fixture
def client(tmp_path) -> Iterator[TestClient]:
    """Boot a fresh app with an isolated on-disk SQLite per test."""
    db_path = tmp_path / "test.db"

    from prelegal_backend import settings as settings_module

    settings_module.settings.database_path = db_path
    db_module.SCHEMA  # touch to keep import

    app = create_app()
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_client(client: TestClient) -> TestClient:
    """A TestClient that has already signed in via fake-auth."""
    response = client.post(
        "/api/auth/login",
        json={"email": "chat-tester@example.com", "name": "Chat Tester"},
    )
    assert response.status_code == 200, response.text
    return client
