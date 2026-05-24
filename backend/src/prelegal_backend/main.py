from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import auth, db, documents_router, templates
from .settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    conn = db.connect(settings.database_path)
    db.init_schema(conn)
    app.state.db = conn
    try:
        yield
    finally:
        conn.close()


def create_app() -> FastAPI:
    app = FastAPI(title="Prelegal", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth.router)
    app.include_router(templates.catalog_api_router)
    app.include_router(templates.chat_api_router)
    app.include_router(templates.recommend_api_router)
    app.include_router(documents_router.router)
    return app


app = create_app()
