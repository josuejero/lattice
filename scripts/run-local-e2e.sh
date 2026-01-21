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

load_prisma_env() {
  if [ -n "${DATABASE_URL:-}" ]; then
    return
  fi

  local env_files=(".env" ".env.local")
  for env_file in "${env_files[@]}"; do
    if [ -f "$env_file" ]; then
      log "Loading environment variables from $env_file"
      set -o allexport
      # shellcheck disable=SC1090
      source "$env_file"
      set +o allexport
    fi
  done
}

apply_prisma_migrations() {
  log "Applying Prisma migrations..."
  load_prisma_env
  (
    cd packages/db
    pnpm prisma migrate deploy
  )
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

apply_prisma_migrations

log "Running Playwright e2e suite..."
PLAYWRIGHT_TEST=1 pnpm -C apps/web test:e2e:run
