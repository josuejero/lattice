# Lattice
[![Live Site](https://img.shields.io/website?down_color=red&down_message=offline&style=flat&up_color=brightgreen&up_message=online&url=https%3A%2F%2Flattice-web-mauve.vercel.app)](https://lattice-web-mauve.vercel.app/)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-pnpm%20test-lightgrey?style=flat)](#development-workflow)
[![CI](https://github.com/josuejero/lattice/actions/workflows/ci.yml/badge.svg)](https://github.com/josuejero/lattice/actions/workflows/ci.yml)

Privacy-respecting scheduling for groups and teams that need to coordinate without sacrificing control or trust.

## Project memory

For engineering continuation, read these in order as needed:

- `HANDOFF.md` — what is true now, current blocker, and exact next action.
- `PROJECT_STATE.md` — broader verified implementation and environment state.
- `OPEN_TASKS.md` — current actionable outstanding work.

These repository files are authoritative for engineering continuation. Google Drive provides cross-system navigation, product research, external evidence, milestone release evidence, and historical handoffs; it does not maintain synchronized copies of repository state.

## What makes this project special

- **Privacy-first defaults** – calendars, availability, and suggestions are never exposed unless explicitly shared; encryption helpers keep tokens secure when enabled.
- **Intelligent coordination** – a fairness engine evaluates slot proposals so every member has a voice, even in biased calendars.
- **Modular stack** – a Next.js frontend/API pair works with Prisma-backed data, shared types, and helper packages to keep logic centralized.

## Getting started

### Prerequisites

- Node.js **20.x** or newer (see `engines.node` in `package.json`)
- [pnpm](https://pnpm.io/) (the repo relies on the workspace-aware CLI)
- Docker & Docker Compose (Postgres + Redis run in containers during local development)

### Quick setup

1. `pnpm install` – install workspace dependencies.
2. `cp .env.example .env.local` and fill in any secrets (at minimum set `AUTH_SECRET` to a strong string).
3. `pnpm -w db:up` – boot Postgres and Redis containers described in `docker-compose.yml`.
4. `pnpm -w db:generate` – refresh the Prisma client before any migration.
5. `pnpm -w db:migrate` – bring the database schema up to date.
6. `pnpm dev` – start the Next.js dev server from `apps/web`.

Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health)

### Environment notes

- `DATABASE_URL` / `REDIS_URL` point at the local services started by Docker Compose.
- `AUTH_SECRET` is required for NextAuth; keep it long and random.
- Feature flags such as `SUGGESTIONS_ENABLED` and `EVENTS_ENABLED` live in the `.env` values so you can toggle preview features without code changes.
- When Google Calendar support is needed, populate the `GCAL_*` values plus `TOKEN_ENC_KEY` for encryption-aware flows.

## Database tooling

- `pnpm -w db:seed` – seed the Postgres/PostGIS dataset with demo data.
- `pnpm -w db:reset` – drop and recreate the schema when migrations diverge from the state machine.
- `pnpm -w db:studio` – launch Prisma Studio at `http://localhost:5555` for quick inspection.
- `pnpm -w db:logs` – tail the Docker logs for both Postgres and Redis.
- `pnpm -w db:down` – stop and remove the containers once you are done.

If you ever need to run Prisma directly (e.g. `prisma migrate deploy` for a production-ready rollout), run it from the db package with `pnpm --filter ./packages/db exec prisma <command>` so the workspace context stays correct.

## Development workflow

- `pnpm -w dev` (`pnpm dev` from the root) – runs the Next.js app (UI + API routes) for live editing.
- `pnpm -w lint` – lint the entire workspace.
- `pnpm -w typecheck` – run TypeScript checks across the workspace.
- `pnpm -w test` – execute automated test suites (unit, integration, etc.).
- `pnpm -w build` – produce production-ready artifacts for each package/app.
- `pnpm format` / `pnpm format:check` – apply or verify Prettier formatting (includes Tailwind plugin).

> The root `package.json` scripts wrap workspace commands so you only need to run `pnpm <script>` at the root; workspace scope (`-w`) is applied where appropriate.

## Repository layout

- `apps/web` – Next.js + App Router powering the public UI, API handling, and auth routes.
- `packages/db` – Prisma schema, migrations, and helpers for database access. The `package.json` exposes Prisma commands consumed by the root scripts.
- `packages/shared` – shared types, environment validation logic, and helpers that keep backend and frontend in sync.
- `docs/` – architecture, API notes, fairness design, threat modeling, and ADRs.

## Documentation

- `docs/api.md` – API surface and contract expectations.
- `docs/architecture.md` – overall system design, data flow, and service boundaries.
- `docs/fairness-engine.md` – current fairness and event-aware ranking design.
- `docs/threat-model.md` – security assets, trust boundaries, threats, mitigations, and validation needs.
- `docs/adr/` – architectural decision records for consequential decisions.

## Contributing & support

- Follow `CONTRIBUTING.md` for branching, testing, and review guidelines.
- Respect the behavior outlined in `CODE_OF_CONDUCT.md`.
- Need to fix a bug or add a feature? Start by opening an issue with steps to reproduce or a detailed proposal.
