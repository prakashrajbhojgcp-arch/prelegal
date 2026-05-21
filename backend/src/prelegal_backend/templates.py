from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from fastapi import APIRouter, HTTPException, status

from .settings import settings


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


router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("")
def list_templates() -> dict[str, Any]:
    return load_catalog()
