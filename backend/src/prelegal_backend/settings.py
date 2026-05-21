from __future__ import annotations

import secrets
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="PRELEGAL_", extra="ignore")

    database_path: Path = Path("/app/data/prelegal.db")
    catalog_path: Path = REPO_ROOT / "config.json"
    templates_dir: Path = REPO_ROOT / "templates"
    session_secret: str = secrets.token_urlsafe(32)
    session_cookie_name: str = "prelegal_session"
    session_max_age_seconds: int = 60 * 60 * 24 * 7
    cors_origins: list[str] = ["http://localhost:3000"]


settings = Settings()
