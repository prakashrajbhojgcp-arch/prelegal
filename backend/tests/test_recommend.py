from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

import prelegal_backend.templates.recommend_router as recommend_module


def _fake_completion(content: str):
    return SimpleNamespace(
        choices=[
            SimpleNamespace(message=SimpleNamespace(content=content)),
        ]
    )


def test_recommend_returns_supported_match(
    monkeypatch: pytest.MonkeyPatch, auth_client: TestClient
) -> None:
    monkeypatch.setattr(
        recommend_module,
        "completion",
        lambda **_: _fake_completion(
            json.dumps(
                {
                    "kind": "supported",
                    "slug": "mutual-nda",
                    "explanation": "Sounds like a mutual NDA.",
                }
            )
        ),
    )

    response = auth_client.post(
        "/api/templates/recommend",
        json={"description": "an NDA between two startups"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["kind"] == "supported"
    assert body["slug"] == "mutual-nda"
    assert body["name"] == "Mutual NDA"
    assert "NDA" in body["explanation"]


def test_recommend_falls_back_when_model_returns_unknown_slug(
    monkeypatch: pytest.MonkeyPatch, auth_client: TestClient
) -> None:
    monkeypatch.setattr(
        recommend_module,
        "completion",
        lambda **_: _fake_completion(
            json.dumps(
                {
                    "kind": "supported",
                    "slug": "non-existent-doc",
                    "explanation": "Misguided answer.",
                }
            )
        ),
    )

    response = auth_client.post(
        "/api/templates/recommend",
        json={"description": "something obscure"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    # Router rewrites to mutual-nda / unsupported when the model hallucinates.
    assert body["slug"] == "mutual-nda"
    assert body["kind"] == "unsupported"


def test_recommend_returns_unsupported_with_closest_match(
    monkeypatch: pytest.MonkeyPatch, auth_client: TestClient
) -> None:
    monkeypatch.setattr(
        recommend_module,
        "completion",
        lambda **_: _fake_completion(
            json.dumps(
                {
                    "kind": "unsupported",
                    "slug": "csa",
                    "explanation": "We don't generate employment agreements, but a CSA is the closest commercial contract we can produce.",
                }
            )
        ),
    )

    response = auth_client.post(
        "/api/templates/recommend",
        json={"description": "I need an employment contract"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["kind"] == "unsupported"
    assert body["slug"] == "csa"
    assert "Cloud Service Agreement" in body["name"]


def test_recommend_400s_on_empty_description(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/api/templates/recommend",
        json={"description": "   "},
    )
    assert response.status_code == 400


def test_recommend_502_on_llm_error(
    monkeypatch: pytest.MonkeyPatch, auth_client: TestClient
) -> None:
    def boom(**_: Any) -> None:
        raise RuntimeError("openrouter exploded")

    monkeypatch.setattr(recommend_module, "completion", boom)

    response = auth_client.post(
        "/api/templates/recommend",
        json={"description": "an NDA"},
    )
    assert response.status_code == 502
    assert response.json()["detail"] == "AI service unavailable"


def test_recommend_requires_auth(client: TestClient) -> None:
    response = client.post(
        "/api/templates/recommend",
        json={"description": "an NDA"},
    )
    assert response.status_code == 401


def test_recommend_system_prompt_includes_every_catalog_slug() -> None:
    prompt = recommend_module._build_system_prompt()  # noqa: SLF001
    for slug in [
        "mutual-nda",
        "mutual-nda-coverpage",
        "csa",
        "design-partner-agreement",
        "sla",
        "psa",
        "dpa",
        "software-license-agreement",
        "partnership-agreement",
        "pilot-agreement",
        "baa",
        "ai-addendum",
    ]:
        assert slug in prompt, f"slug={slug} missing from recommend system prompt"
