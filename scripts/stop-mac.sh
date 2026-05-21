#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Stopping Prelegal…"
docker compose down
