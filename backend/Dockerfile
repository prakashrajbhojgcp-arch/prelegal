FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1

COPY --from=ghcr.io/astral-sh/uv:0.9.26 /uv /usr/local/bin/uv

WORKDIR /app

COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev --no-install-project

COPY src ./src
RUN uv sync --no-dev

# Catalog + templates live one level up in the repo; Docker Compose mounts /repo
# so the backend can read them. Database lives in /app/data and is wiped each
# container start (see scripts/start-*).
ENV PRELEGAL_CATALOG_PATH=/repo/config.json \
    PRELEGAL_TEMPLATES_DIR=/repo/templates \
    PRELEGAL_DATABASE_PATH=/app/data/prelegal.db \
    PRELEGAL_CORS_ORIGINS='["http://localhost:3000"]'

RUN mkdir -p /app/data

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "prelegal_backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
