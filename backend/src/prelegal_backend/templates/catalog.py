"""Catalog loader: reads config.json and exposes the list of templates."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from fastapi import HTTPException, status

from ..settings import settings


@dataclass(frozen=True)
class CatalogTemplate:
    name: str
    description: str
    filename: str
    source: str | None = None

    @property
    def slug(self) -> str:
        """`Mutual-NDA.md` → `mutual-nda`. Matches frontend slug derivation."""
        stem = self.filename.removesuffix(".md")
        return stem.lower()


@lru_cache(maxsize=1)
def load_catalog() -> dict[str, Any]:
    path = settings.catalog_path
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Catalog not found at {path}",
        )
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def catalog_templates() -> list[CatalogTemplate]:
    return [CatalogTemplate(**t) for t in load_catalog()["templates"]]
