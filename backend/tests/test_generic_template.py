from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any

import pytest

from prelegal_backend.templates import chat_engine as chat_module
from prelegal_backend.templates.chat_engine import ChatMessage, handle_turn
from prelegal_backend.templates.generic import (
    GenericData,
    Party,
    PartialGenericData,
    deep_merge_generic,
)
from prelegal_backend.templates.specs import get_spec


def _fake_completion(content: str):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))]
    )


def test_deep_merge_updates_field_values() -> None:
    current = GenericData(
        fields={"effectiveDate": "", "fees": ""},
        parties=[Party(), Party()],
    )
    partial = PartialGenericData.model_validate(
        {"fields": {"effectiveDate": "2026-05-23"}}
    )
    merged = deep_merge_generic(current, partial)
    assert merged.fields["effectiveDate"] == "2026-05-23"
    assert merged.fields["fees"] == ""


def test_deep_merge_extends_parties_when_partial_has_more() -> None:
    current = GenericData(fields={}, parties=[Party()])
    partial = PartialGenericData.model_validate(
        {
            "parties": [
                {"company": "Acme"},
                {"company": "Globex"},
            ]
        }
    )
    merged = deep_merge_generic(current, partial)
    assert len(merged.parties) == 2
    assert merged.parties[0].company == "Acme"
    assert merged.parties[1].company == "Globex"


def test_deep_merge_only_updates_provided_party_leaves() -> None:
    current = GenericData(
        fields={},
        parties=[
            Party(name="Ada", company="Acme"),
            Party(name="Grace", company="Globex"),
        ],
    )
    partial = PartialGenericData.model_validate(
        {"parties": [{"title": "CEO"}, None]}
    )
    merged = deep_merge_generic(current, partial)
    assert merged.parties[0].title == "CEO"
    assert merged.parties[0].name == "Ada"
    assert merged.parties[0].company == "Acme"
    assert merged.parties[1].name == "Grace"


@pytest.mark.parametrize(
    "slug",
    [
        "baa",
        "csa",
        "dpa",
        "sla",
        "psa",
        "software-license-agreement",
        "partnership-agreement",
        "pilot-agreement",
        "design-partner-agreement",
        "ai-addendum",
        "mutual-nda-coverpage",
    ],
)
def test_each_generic_template_is_registered_and_callable(
    monkeypatch: pytest.MonkeyPatch, slug: str
) -> None:
    spec = get_spec(slug)
    assert spec is not None, f"template {slug} is not registered"

    monkeypatch.setattr(
        chat_module,
        "completion",
        lambda **_: _fake_completion(
            json.dumps(
                {
                    "assistant_message": "Got it.",
                    "updated_fields": {
                        "parties": [{"company": "Acme"}, {"company": "Globex"}]
                    },
                    "is_complete": False,
                }
            )
        ),
    )

    initial = spec.default_data()
    response = handle_turn(
        spec,
        [ChatMessage(role="user", content="parties are Acme and Globex")],
        initial,
    )
    assert response.assistant_message == "Got it."
    assert response.merged_fields.parties[0].company == "Acme"
    assert response.merged_fields.parties[1].company == "Globex"


def test_generic_chat_endpoint_happy_path(
    monkeypatch: pytest.MonkeyPatch, auth_client: Any
) -> None:
    monkeypatch.setattr(
        chat_module,
        "completion",
        lambda **_: _fake_completion(
            json.dumps(
                {
                    "assistant_message": "What's the uptime target?",
                    "updated_fields": {
                        "fields": {"services": "Acme Cloud Platform"}
                    },
                    "is_complete": False,
                }
            )
        ),
    )

    spec = get_spec("sla")
    assert spec is not None
    initial = spec.default_data().model_dump(by_alias=True)

    response = auth_client.post(
        "/api/templates/sla/chat",
        json={
            "messages": [
                {"role": "user", "content": "Provider runs Acme Cloud Platform"}
            ],
            "current_fields": initial,
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["mergedFields"]["fields"]["services"] == "Acme Cloud Platform"
