"""GET /api/templates — returns the catalog config.json."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from .catalog import load_catalog

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("")
def list_templates() -> dict[str, Any]:
    return load_catalog()
