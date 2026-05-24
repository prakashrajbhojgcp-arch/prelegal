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
    time.sleep(0.02)
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
    time.sleep(0.02)
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
