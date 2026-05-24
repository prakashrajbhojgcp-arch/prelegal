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
        "party1": {
            "name": "",
            "title": "",
            "company": "Acme",
            "noticeAddress": "",
            "date": "2026-05-24",
        },
        "party2": {
            "name": "",
            "title": "",
            "company": "Globex",
            "noticeAddress": "",
            "date": "2026-05-24",
        },
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
    assert (
        client.post(
            "/api/documents", json={"slug": "mutual-nda", "fields": {}}
        ).status_code
        == 401
    )
    assert client.get("/api/documents").status_code == 401
    assert client.get("/api/documents/1").status_code == 401
    assert client.patch("/api/documents/1", json={"fields": {}}).status_code == 401
    assert client.delete("/api/documents/1").status_code == 401
