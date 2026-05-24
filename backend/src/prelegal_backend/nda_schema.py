"""Pydantic mirror of the TS NdaData shape in frontend/src/lib/nda-schema.ts.

Wire format is camelCase (to match the TS shape); Python attributes use
snake_case via Field aliases.
"""

from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Discriminator, Field, RootModel


def _to_camel(s: str) -> str:
    head, *tail = s.split("_")
    return head + "".join(w.capitalize() for w in tail)


class _Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
        extra="forbid",
    )


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
