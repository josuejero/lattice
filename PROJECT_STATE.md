# Lattice project state

Last verified: 2026-09-05

## Product state

Lattice is implemented as a multi-tenant scheduling web application. The current repository exposes authenticated organization workflows for availability, events, suggestions, integrations, dashboards, and audit history.

## Source and delivery

- Repository: `josuejero/lattice`
- Default branch: `master`
- Accepted baseline at this update: `90d764a630cbef2e8ee00c1f57ebeba19c1a554a`
- Latest merged work: PR #3, event-aware scheduling and simulation quality improvements.
- CI: successful for the accepted baseline.
- Hosting: Vercel is wired to the repository; the repository advertises `https://lattice-web-mauve.vercel.app/` as the live site.
- Production SHA equivalence: not independently verified in the 2026-09-05 audit.

## Application architecture

- Next.js App Router application with Route Handlers for API endpoints.
- Postgres persistence through Prisma; schema and migrations live under `packages/db/prisma/`.
- Redis support under `packages/shared/src/redis/`; production architecture names Upstash.
- Auth.js/NextAuth authentication.
- Organization membership/role guards enforce tenant-scoped access on protected API operations.
- Audit logging is implemented for important operations including Calendar synchronization/writeback.

See `docs/architecture.md` for the current repository-native architecture summary.

## Availability and scheduling

- Recurring availability templates are stored separately from one-off availability/unavailability overrides.
- Suggestion generation evaluates attendee availability in attendee-local time zones and emits UTC candidate intervals.
- Google Calendar busy intervals are synchronized into provider-specific busy blocks for the connected user and organization.
- Scheduled events and suggestion confirmation are persisted in the application database.
- Event-aware ranking is present for different event archetypes and target groups.

## Fairness

The base suggestion engine currently uses a deterministic local-time burden model:

- attendance score = proportion of attendees available;
- inconvenience score = `1 - average local-time penalty` among available attendees;
- fairness score = `1 - worst local-time penalty` among available attendees;
- base total = `0.6 * attendance + 0.2 * inconvenience + 0.2 * fairness`.

Event-aware ranking composes the base candidate signals with event-archetype weights for target turnout, broad turnout, time fit, fairness, and inconvenience. The historical idea of rolling 30-day burden budgets is not implemented as the current fairness authority.

See `docs/fairness-engine.md` and the suggestion/simulation source for details.

## Google Calendar integration

Verified current capabilities:

- OAuth connection with OpenID identity scopes plus Calendar access;
- calendar discovery/listing;
- organization-specific calendar selection;
- free/busy reads for selected calendars;
- merged busy-block synchronization;
- sync-run success/error recording and `lastSyncAt` tracking;
- feature-flagged Google Calendar writeback for confirmed Lattice events;
- writeback to the connected user's primary calendar with attendee invitations and stored external event ID/link;
- writeback success/error state and audit records.

Not verified in current source:

- updating a previously written Google event;
- deleting a previously written Google event;
- bidirectional event reconciliation.

Current requested Calendar scopes are `calendar.readonly` and `calendar.events`. Scope changes require integration validation rather than documentation-only edits.

## Tests and simulations

Repository evidence includes:

- Vitest/unit tests for suggestion ranking, event-aware logic, simulation output/quality, RBAC, OpenAPI, availability intervals, and event conflicts;
- Playwright E2E coverage for representative authentication, availability, confirmation, home, and suggestion flows;
- deterministic mock-simulation and comparison scripts under `apps/web/scripts/`;
- event-aware simulation scenarios and property tests under `apps/web/src/lib/simulation/`;
- GitHub Actions CI.

Major outputs may be archived in Drive only when they are release/product evidence; source, fixtures, and normal CI history remain repository-native.

## Security and privacy

Core protected assets include identities, organization data, availability, Calendar metadata, and OAuth tokens. Multi-tenant organization scoping, token confidentiality, scope minimization, sensitive-data logging, and external writeback are continuing security concerns. See `docs/threat-model.md`.

## Architecture decisions

`docs/adr/` currently contains the repository ADR template but no accepted ADR corpus. New architecturally significant decisions should use the existing local template and append-only/superseding practice rather than a Drive decision document.

## Project-memory hierarchy

- `HANDOFF.md`: current continuation truth and exact next action.
- `PROJECT_STATE.md`: broader verified capabilities and subsystem state.
- `OPEN_TASKS.md`: actionable outstanding work.
- Git history, PRs, CI, code, and repository docs provide deeper evidence and chronology.

Google Drive is not an engineering project-state authority.
