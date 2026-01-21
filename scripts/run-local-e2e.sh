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

build_workspace_packages() {
  log "Building workspace packages..."
  pnpm --filter @lattice/db build
  pnpm --filter @lattice/shared build
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

ensure_auth_secret() {
  if [ -n "${AUTH_SECRET:-}" ]; then
    return
  fi

  local env_example=".env.example"
  if [ ! -f "$env_example" ]; then
    log "AUTH_SECRET missing and $env_example is not available."
    log "Please set AUTH_SECRET in the environment before running the e2e script."
    exit 1
  fi

  local fallback_auth_secret
  fallback_auth_secret=$(
    # shellcheck disable=SC1090
    source "$env_example"
    printf "%s" "$AUTH_SECRET"
  )

  if [ -z "$fallback_auth_secret" ]; then
    log "AUTH_SECRET is not defined inside $env_example."
    exit 1
  fi

  log "AUTH_SECRET missing; using default from $env_example for the test run."
  export AUTH_SECRET="$fallback_auth_secret"
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

ensure_auth_secret

build_workspace_packages

log "Running Playwright e2e suite..."
log "Generating Prisma client in packages/db..."
pnpm db:generate
PLAYWRIGHT_TEST=1 pnpm -C apps/web test:e2e:run
