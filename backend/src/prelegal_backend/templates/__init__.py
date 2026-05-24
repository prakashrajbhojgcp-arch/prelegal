"""Templates package: catalog, per-template specs, dynamic chat router."""

from .catalog_router import router as catalog_api_router
from .chat_router import router as chat_api_router
from .recommend_router import router as recommend_api_router

__all__ = [
    "catalog_api_router",
    "chat_api_router",
    "recommend_api_router",
]
