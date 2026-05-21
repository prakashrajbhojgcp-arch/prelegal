from fastapi.testclient import TestClient


def login(client: TestClient, email: str = "ada@example.com", name: str = "Ada Lovelace"):
    return client.post("/api/auth/login", json={"email": email, "name": name})


def test_login_creates_user_and_sets_cookie(client: TestClient) -> None:
    response = login(client)
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "ada@example.com"
    assert body["name"] == "Ada Lovelace"
    assert isinstance(body["id"], int)
    assert "prelegal_session" in response.cookies


def test_login_is_idempotent_on_email(client: TestClient) -> None:
    first = login(client, name="Ada L.")
    assert first.status_code == 200
    second = login(client, name="Ada Lovelace")
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert second.json()["name"] == "Ada Lovelace"  # name updated on re-login


def test_me_requires_session(client: TestClient) -> None:
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_me_returns_user_after_login(client: TestClient) -> None:
    login(client)
    response = client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["email"] == "ada@example.com"


def test_logout_clears_session(client: TestClient) -> None:
    login(client)
    response = client.post("/api/auth/logout")
    assert response.status_code == 204
    # The server must instruct the browser to drop the cookie via Set-Cookie;
    # don't help the client by clearing its jar manually.
    set_cookie = response.headers.get("set-cookie", "")
    assert "prelegal_session=" in set_cookie
    assert ("Max-Age=0" in set_cookie) or ("expires=" in set_cookie.lower())
    follow_up = client.get("/api/auth/me")
    assert follow_up.status_code == 401


def test_login_rejects_invalid_email(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"email": "not-an-email", "name": "x"})
    assert response.status_code == 422


def test_login_rejects_blank_name(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"email": "a@b.co", "name": ""})
    assert response.status_code == 422


def test_tampered_cookie_is_rejected(client: TestClient) -> None:
    login(client)
    client.cookies.set("prelegal_session", "obviously-not-signed")
    response = client.get("/api/auth/me")
    assert response.status_code == 401
