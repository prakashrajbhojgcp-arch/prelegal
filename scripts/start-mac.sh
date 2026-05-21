#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Starting Prelegal (Docker Compose)…"
docker compose up -d --build
echo
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:8000"
