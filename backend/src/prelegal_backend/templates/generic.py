"""Shared scaffolding for templates that use a flat field manifest.

Every non-Mutual-NDA template currently uses the same shape: a `fields` dict
keyed by manifest entries plus a fixed-size list of `Party` objects. This
module exposes:

    - `Party` / `PartialParty` — common party model
    - `GenericData` / `PartialGenericData` — manifest-driven document data
    - `deep_merge_generic` — applies a partial onto a current snapshot
    - `build_generic_spec` — factory that registers a `TemplateSpec`

Per-template modules just call `build_generic_spec(...)` with their slug,
name, field manifest, party count, and a short body description.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from pydantic import Field

from .base import _Base
from .specs import TemplateSpec, register


class Party(_Base):
    name: str = ""
    title: str = ""
    company: str = ""
    notice_address: str = ""
    date: str = ""


class PartialParty(_Base):
    name: str | None = None
    title: str | None = None
    company: str | None = None
    notice_address: str | None = None
    date: str | None = None


class GenericData(_Base):
    fields: dict[str, str] = Field(default_factory=dict)
    parties: list[Party] = Field(default_factory=list)


class PartialGenericData(_Base):
    """Leaf-optional variant. The LLM populates only the fields it learned
    about in the latest user turn."""

    fields: dict[str, str] | None = None
    parties: list[PartialParty | None] | None = None


@dataclass(frozen=True)
class FieldDef:
    """One slot the chat agent should collect."""

    key: str  # camelCase key persisted in `fields`
    label: str  # human-readable label (used in prompts + form labels)
    description: str  # one-line hint for the LLM and the form


def _today_iso() -> str:
    return date.today().isoformat()


def _empty_party() -> Party:
    return Party(date=_today_iso())


def deep_merge_generic(
    current: GenericData,
    partial: PartialGenericData,
) -> GenericData:
    """Return a new `GenericData` with non-None leaves of `partial` applied."""

    next_fields = dict(current.fields)
    if partial.fields:
        for key, value in partial.fields.items():
            if value is None:
                continue
            next_fields[key] = value

    next_parties = [p.model_copy() for p in current.parties]
    if partial.parties is not None:
        while len(next_parties) < len(partial.parties):
            next_parties.append(_empty_party())
        for index, pp in enumerate(partial.parties):
            if pp is None:
                continue
            base = next_parties[index].model_dump(by_alias=False)
            for key, value in pp.model_dump(
                by_alias=False, exclude_none=True
            ).items():
                base[key] = value
            next_parties[index] = Party.model_validate(base)

    return GenericData(fields=next_fields, parties=next_parties)


def _format_manifest(manifest: tuple[FieldDef, ...]) -> str:
    return "\n".join(
        f"- {f.key} ({f.label}): {f.description}" for f in manifest
    )


def _build_system_prompt(
    *,
    name: str,
    description: str,
    manifest: tuple[FieldDef, ...],
    num_parties: int,
):
    """Closure that returns the per-turn system prompt."""

    party_word = "party" if num_parties == 1 else "parties"
    party_list = ", ".join(f"party{i + 1}" for i in range(num_parties))

    def system_prompt(current: GenericData) -> str:
        snapshot = current.model_dump_json(by_alias=True, indent=2)
        return (
            f"You are helping the user draft a Common Paper {name}.\n"
            f"\n"
            f"Document description: {description}\n"
            f"\n"
            "Collect the following fields by asking short, friendly questions"
            " — one or two fields at a time. Never fire-hose:\n"
            f"{_format_manifest(manifest)}\n"
            f"\n"
            f"Also collect the {num_parties} {party_word} ({party_list}). Each"
            " party has: name, title, company, noticeAddress, date (ISO"
            " yyyy-mm-dd).\n"
            "\n"
            "Document state so far:\n"
            f"{snapshot}\n"
            "\n"
            "Only populate `updated_fields` with values the latest user"
            " message clarified — do NOT echo state back. Each entry in"
            " `updated_fields.fields` must use one of the field keys listed"
            " above. Leave a leaf out (or send null) if the user did not"
            " just answer it. Set is_complete=true once every field above is"
            " non-empty AND every party has at least a company name AND you"
            " have confirmed the draft with the user. Otherwise"
            " is_complete=false."
        )

    return system_prompt


def build_generic_spec(
    *,
    slug: str,
    name: str,
    description: str,
    manifest: tuple[FieldDef, ...],
    num_parties: int,
    greeting: str,
) -> TemplateSpec[GenericData, PartialGenericData]:
    """Register and return a TemplateSpec for a generic field-manifest doc."""

    def default_data() -> GenericData:
        return GenericData(
            fields={f.key: "" for f in manifest},
            parties=[_empty_party() for _ in range(num_parties)],
        )

    return register(
        TemplateSpec(
            slug=slug,
            name=name,
            data_model=GenericData,
            partial_model=PartialGenericData,
            default_data=default_data,
            deep_merge=deep_merge_generic,
            system_prompt=_build_system_prompt(
                name=name,
                description=description,
                manifest=manifest,
                num_parties=num_parties,
            ),
            greeting=greeting,
        )
    )
