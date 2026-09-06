# Architecture

Last verified: 2026-09-05

## High-level

Lattice is a Next.js App Router application with UI and server Route Handlers in `apps/web`. Persistent application state is stored in Postgres through Prisma. Redis-backed shared infrastructure supports rate limiting and related ephemeral coordination. Authentication uses Auth.js/NextAuth, and protected organization routes enforce membership/role checks before accessing tenant-scoped data.

Production-oriented repository configuration identifies Neon for Postgres and Upstash for Redis. Deployment is handled through Vercel; runtime environment and secrets remain deployment-system authorities rather than repository or Drive data.

## Packages

- `apps/web` — Next.js UI, API Route Handlers, auth, product features, Calendar integration, tests, and simulation tooling.
- `packages/db` — Prisma schema, migrations, seed data, and database client.
- `packages/shared` — shared HTTP envelopes/errors, audit logging, environment handling, rate limiting, and Redis client support.

## Core product flows

### Availability

Recurring availability templates and one-off `AVAILABLE`/`UNAVAILABLE` overrides are normalized in attendee-local time zones. Suggestion generation converts viable slots to UTC for ranking and persistence.

Google Calendar busy time is an additional constraint source. Selected calendars are queried through the Calendar free/busy API and merged into provider-specific busy blocks for the connected user and organization.

### Suggestions and fairness

The base suggestion engine ranks candidate intervals using attendance, average local-time inconvenience, and worst-attendee local-time burden. Event-aware ranking can then apply an event archetype and target group to weigh target turnout, broad turnout, time fit, fairness, and inconvenience.

`docs/fairness-engine.md` is the code-coupled design summary; source and tests under `apps/web/src/lib/suggestions/` and `apps/web/src/lib/simulation/` are the executable authority.

### Events

Suggestion confirmation can create persisted scheduled events. Event-aware context is included in the current schema/migration history. Event conflicts and representative confirmation flows have repository tests.

### Google Calendar

Current integration separates connection, calendar selection, busy-time synchronization, and event writeback:

1. OAuth connection requests identity scopes plus Calendar read/write scopes.
2. Calendar discovery lists calendars visible to the connected account.
3. Organization-specific selections identify calendars used as busy sources.
4. Sync reads free/busy data for the selected calendars, merges intervals, and replaces overlapping Google-derived busy blocks for the requested range.
5. Confirmed Lattice events can be written to the connected user's primary Google Calendar when `EVENTS_ENABLED` and `GCAL_WRITEBACK_ENABLED` are enabled.
6. Writeback records pending/success/error state, external event ID/link, and audit evidence.

No current implementation was verified for updating or deleting a previously written Google event; do not describe the integration as fully bidirectional.

## Multi-tenant boundary

Organization scoping is a core invariant. Protected API operations use organization membership/role guards, and database lookups include organization identifiers where required. Changes to authentication, tenancy, Calendar integration, privileged audit visibility, or other trust boundaries require threat-model review.

## Persistence and migrations

`packages/db/prisma/schema.prisma` and `packages/db/prisma/migrations/` are the database schema authority. Consequential schema changes must use the repository migration workflow and be validated against application compatibility and retained data.

## Audit and observability

Lattice records application audit events for security- and workflow-relevant actions including Calendar synchronization and writeback. Calendar sync runs track status and failure detail; connections track last successful sync time. An audit UI exists, but the presence of an audit page does not replace validation of audit semantics or tenant isolation.

## Project memory and decisions

- `HANDOFF.md` — current continuation truth.
- `PROJECT_STATE.md` — broader verified implementation state.
- `OPEN_TASKS.md` — current actionable work.
- `docs/adr/` — architecturally significant decisions using the repository's established template.

Google Drive is for cross-system navigation, product research, external evidence, milestone release evidence, and genuinely historical cross-system handoffs; it is not an implementation or architecture authority.
