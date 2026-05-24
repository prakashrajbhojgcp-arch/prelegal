"""Per-template specs and registry.

A `TemplateSpec` bundles everything the generic chat router needs to handle
turns for a given template slug:

    - `data_model`     — full Pydantic schema of the document data
    - `partial_model`  — leaf-optional variant used as Structured Outputs
                         schema for the LLM (each leaf the LLM didn't update
                         is omitted)
    - `default_data`   — factory returning a starting `data_model` instance
    - `deep_merge`     — applies a partial to a current to produce the next
                         current; term-style discriminated unions are
                         replaced atomically, scalars are overwritten
    - `system_prompt`  — function returning the per-turn system prompt given
                         the current snapshot
    - `greeting`       — first assistant message shown when the chat opens

Registry is populated at import time via `register(spec)`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Generic, TypeVar

from pydantic import BaseModel

DataT = TypeVar("DataT", bound=BaseModel)
PartialT = TypeVar("PartialT", bound=BaseModel)


@dataclass(frozen=True)
class TemplateSpec(Generic[DataT, PartialT]):
    slug: str
    name: str
    data_model: type[DataT]
    partial_model: type[PartialT]
    default_data: Callable[[], DataT]
    deep_merge: Callable[[DataT, PartialT], DataT]
    system_prompt: Callable[[DataT], str]
    greeting: str


_REGISTRY: dict[str, TemplateSpec] = {}


def register(spec: TemplateSpec) -> TemplateSpec:
    _REGISTRY[spec.slug] = spec
    return spec


def get_spec(slug: str) -> TemplateSpec | None:
    # Lazily import every template module so registration side-effects run.
    _ensure_imported()
    return _REGISTRY.get(slug)


def all_specs() -> list[TemplateSpec]:
    _ensure_imported()
    return list(_REGISTRY.values())


_imported = False


def _ensure_imported() -> None:
    global _imported
    if _imported:
        return
    _imported = True
    # Import each template subpackage so its `register(...)` runs.
    from . import (  # noqa: F401
        ai_addendum,
        baa,
        csa,
        design_partner,
        dpa,
        mutual_nda,
        mutual_nda_coverpage,
        partnership,
        pilot,
        psa,
        sla,
        software_license,
    )
