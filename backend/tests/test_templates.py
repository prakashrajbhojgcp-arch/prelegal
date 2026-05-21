from fastapi.testclient import TestClient


def test_templates_endpoint_returns_catalog(client: TestClient) -> None:
    response = client.get("/api/templates")
    assert response.status_code == 200
    body = response.json()
    assert "templates" in body
    assert isinstance(body["templates"], list)
    assert len(body["templates"]) > 0
    sample = body["templates"][0]
    assert {"name", "description", "filename"}.issubset(sample.keys())
