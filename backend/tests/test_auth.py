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
