"""Pydantic mirror of the TS NdaData shape in
frontend/src/lib/templates/mutual-nda/schema.ts.

Wire format is camelCase (to match the TS shape); Python attributes use
snake_case via Field aliases.
"""

from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import Discriminator, Field, RootModel

from ..base import _Base


class Party(_Base):
    name: str
    title: str
    company: str
    notice_address: str
    date: str  # ISO yyyy-mm-dd


class _MndaTermYears(_Base):
    kind: Literal["years"]
    years: int = Field(ge=1)


class _MndaTermUntilTerminated(_Base):
    kind: Literal["untilTerminated"]


class MndaTerm(RootModel):
    """Discriminated union for MNDA term."""
    root: Annotated[
        Union[_MndaTermYears, _MndaTermUntilTerminated],
        Discriminator("kind"),
    ]

    @property
    def kind(self):
        return self.root.kind

    @property
    def years(self):
        if isinstance(self.root, _MndaTermYears):
            return self.root.years
        return None

    def __getattr__(self, name):
        return getattr(self.root, name)


class _ConfTermYears(_Base):
    kind: Literal["years"]
    years: int = Field(ge=1)


class _ConfTermPerpetuity(_Base):
    kind: Literal["perpetuity"]


class ConfidentialityTerm(RootModel):
    """Discriminated union for confidentiality term."""
    root: Annotated[
        Union[_ConfTermYears, _ConfTermPerpetuity],
        Discriminator("kind"),
    ]

    @property
    def kind(self):
        return self.root.kind

    def __getattr__(self, name):
        return getattr(self.root, name)


class NdaData(_Base):
    purpose: str
    effective_date: str
    mnda_term: MndaTerm
    confidentiality_term: ConfidentialityTerm
    governing_law: str
    jurisdiction: str
    modifications: str
    party1: Party
    party2: Party


class PartialParty(_Base):
    name: str | None = None
    title: str | None = None
    company: str | None = None
    notice_address: str | None = None
    date: str | None = None


class PartialNdaData(_Base):
    purpose: str | None = None
    effective_date: str | None = None
    # Term fields use the same discriminated-union types as NdaData. When the
    # LLM wants to update a term, it must send a complete, valid term object;
    # we do not allow partial term updates (would be ambiguous which kind).
    mnda_term: MndaTerm | None = None
    confidentiality_term: ConfidentialityTerm | None = None
    governing_law: str | None = None
    jurisdiction: str | None = None
    modifications: str | None = None
    party1: PartialParty | None = None
    party2: PartialParty | None = None


def deep_merge_fields(current: NdaData, partial: PartialNdaData) -> NdaData:
    """Return a new NdaData with every non-None leaf in `partial` applied to
    `current`. Term unions are replaced atomically (not merged)."""

    merged = current.model_dump(by_alias=False)

    def _apply_party(target: dict, src: PartialParty | None) -> None:
        if src is None:
            return
        for field_name, value in src.model_dump(by_alias=False, exclude_none=True).items():
            target[field_name] = value

    if partial.purpose is not None:
        merged["purpose"] = partial.purpose
    if partial.effective_date is not None:
        merged["effective_date"] = partial.effective_date
    if partial.mnda_term is not None:
        merged["mnda_term"] = partial.mnda_term.model_dump(by_alias=False)
    if partial.confidentiality_term is not None:
        merged["confidentiality_term"] = partial.confidentiality_term.model_dump(by_alias=False)
    if partial.governing_law is not None:
        merged["governing_law"] = partial.governing_law
    if partial.jurisdiction is not None:
        merged["jurisdiction"] = partial.jurisdiction
    if partial.modifications is not None:
        merged["modifications"] = partial.modifications
    _apply_party(merged["party1"], partial.party1)
    _apply_party(merged["party2"], partial.party2)

    return NdaData.model_validate(merged)
