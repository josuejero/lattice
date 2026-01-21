#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

log() {
  echo "[local-e2e] $*"
}

if ! command -v pnpm >/dev/null 2>&1; then
  log "pnpm is required to run the e2e helper."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  log "Docker is required to start the local services."
  exit 1
fi

started_services=0

cleanup() {
  if [ "$started_services" -eq 1 ]; then
    log "Stopping local services..."
    pnpm db:down
  fi
}

trap cleanup EXIT

wait_for_postgres() {
  log "Waiting for Postgres to be ready..."
  for attempt in $(seq 1 30); do
    if docker compose exec -T postgres pg_isready -U lattice >/dev/null 2>&1; then
      log "Postgres is ready."
      return 0
    fi
    sleep 1
  done
  log "Postgres did not become ready in time."
  exit 1
}

wait_for_redis() {
  log "Waiting for Redis to be ready..."
  for attempt in $(seq 1 30); do
    if docker compose exec -T redis redis-cli ping >/dev/null 2>&1; then
      log "Redis is ready."
      return 0
    fi
    sleep 1
  done
  log "Redis did not become ready in time."
  exit 1
}

if [ -z "${CI:-}" ]; then
  log "Starting Postgres and Redis via docker compose..."
  pnpm db:up
  started_services=1
  wait_for_postgres
  wait_for_redis
else
  log "CI detected; skipping local service startup."
fi

log "Running Playwright e2e suite..."
PLAYWRIGHT_TEST=1 pnpm -C apps/web test:e2e:run
