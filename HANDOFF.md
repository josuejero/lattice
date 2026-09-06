# Lattice handoff

Last updated: 2026-09-05

## Objective

Lattice is a privacy-conscious group scheduling application that combines recurring availability, one-off overrides, Google Calendar busy time, event scheduling, and deterministic suggestion ranking with explicit fairness signals.

## Current authority

- Canonical repository: https://github.com/josuejero/lattice
- Default branch: `master`
- Accepted application/feature baseline at this handoff: `90d764a630cbef2e8ee00c1f57ebeba19c1a554a`
- Baseline change: merged PR #3, `mock-event-simulation-20260705-203318`, integrating event-aware scheduling and simulation quality improvements.
- Repository project-memory/documentation maintenance is layered on top of that feature baseline; do not assume the moving `master` HEAD is the same commit as the accepted application baseline or the deployed production SHA.
- Last documented local checkout: `C:\Dev\Personal\Lattice` on Windows. Treat current local working-tree status as unknown until checked locally.
- This file is the engineering continuation authority. `PROJECT_STATE.md` holds broader verified state; `OPEN_TASKS.md` holds outstanding work.

## Verified now

- GitHub CI completed successfully for feature baseline SHA `90d764a`.
- The repository contains the Next.js App Router application, Prisma/Postgres persistence and migrations, Redis support, Auth.js-backed authentication, organization-scoped authorization, availability templates/overrides, events, suggestions, audit surfaces, Google Calendar integration, tests, and simulation tooling.
- Google Calendar integration currently supports calendar discovery/selection, free/busy synchronization into Lattice busy blocks, and feature-flagged creation of confirmed Lattice events in the connected user's primary Google Calendar.
- Calendar writeback records pending/success/error state and external event identifiers. No Google Calendar event update/delete implementation was verified in the current source.
- Current OAuth request includes `calendar.readonly` and `calendar.events` in addition to OpenID identity scopes. Do not change scopes without validating discovery, free/busy sync, and writeback together.
- The base fairness calculation remains deterministic: attendance, average local-time inconvenience, and worst-attendee local-time burden contribute to ranking. Event-aware ranking adds event archetype, target-turnout, broad-turnout, time-fit, fairness, and inconvenience weights.
- The old Google Drive `HANDOFF`, `PROJECT_STATE`, `OPEN_TASKS`, and project-memory spreadsheet are historical only. They must not be used to resume engineering work.

## Current limitation / blocker

The repository and CI prove the accepted source state, but this audit could not independently identify the Git SHA currently served by production or prove that production contains feature baseline `90d764a`. It also did not locate a durable production/provider acceptance record for that merged feature state.

## Exact next action

Identify the Git SHA currently deployed to the Lattice production environment and determine whether it contains accepted feature baseline `90d764a`. Then run a bounded release acceptance pass covering the important current flows: authentication/org scoping, availability and suggestions, event confirmation, Google Calendar free/busy sync, and synthetic/test-event Calendar writeback. Record the environment, deployed Git SHA, date, result, and any failures. Preserve only milestone-level evidence outside Git when it adds archival value.

## Do not repeat

- Do not reconstruct current engineering state from the historical Drive project-memory pack.
- Do not create Drive copies of this file, `PROJECT_STATE.md`, `OPEN_TASKS.md`, architecture docs, ADRs, fairness docs, the threat model, tests, simulations, source code, or secrets.
- Do not rerun or reimplement the already merged PR #3 event-aware scheduling work unless new evidence identifies a regression or follow-up requirement.
- Do not broaden or narrow Google Calendar OAuth scopes merely for convenience; review scopes against actual current capabilities and test the resulting integration.

## Evidence and deeper documentation

- Project state: `PROJECT_STATE.md`
- Open work: `OPEN_TASKS.md`
- README: `README.md`
- Architecture: `docs/architecture.md`
- API: `docs/api.md`
- Fairness: `docs/fairness-engine.md`
- Threat model: `docs/threat-model.md`
- ADRs: `docs/adr/`
- CI: https://github.com/josuejero/lattice/actions
- Production URL declared by the repository: https://lattice-web-mauve.vercel.app/
