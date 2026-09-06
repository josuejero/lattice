# Lattice open tasks

Last reviewed: 2026-09-05

This file tracks current actionable engineering/project work. It is not a chronology; completed work belongs in Git history, PRs, release evidence, and `PROJECT_STATE.md`.

## P0 — verify deployed release state

Status: OPEN

Identify the Git SHA currently deployed to the Lattice production environment and determine whether it contains accepted application/feature baseline `90d764a630cbef2e8ee00c1f57ebeba19c1a554a`. Do not assume the deployed SHA equals the current `master` HEAD; documentation/project-memory maintenance can advance `master` without changing application behavior.

Acceptance evidence should record:

- environment and URL;
- deployed Git SHA where the provider exposes it;
- whether that SHA contains the accepted feature baseline;
- date/time;
- authentication and organization-scoping smoke result;
- availability/suggestion smoke result;
- event confirmation result;
- Google Calendar free/busy synchronization using a test/synthetic scenario;
- Google Calendar writeback using a test/synthetic event;
- failures, retries, or partial-success conditions.

Close this task only after the deployed source state and representative provider acceptance are known.

## P1 — review Google Calendar scope fit

Status: OPEN
Dependency: P0 integration acceptance or an equivalent reproducible test environment.

Current OAuth requests include:

- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/calendar.events`

Review these against the actual supported capability set: calendar discovery/selection, free/busy synchronization, and event creation/writeback. Prefer narrower scopes only if the complete supported flow still works. Do not change scopes as a documentation-only cleanup.

Expected outcome: either retain the current scopes with a documented rationale or make a tested scope change through the normal implementation/PR process. Update `docs/threat-model.md` if the trust/permission boundary changes.

## P1 — establish release-level evidence for event-aware scheduling

Status: OPEN
Dependency: P0 may satisfy most of this if the same acceptance pass is used.

The repository has deterministic unit/property/simulation tooling and green CI for the merged event-aware work, but this audit did not locate a durable release-level report tied to the accepted feature baseline. For the next meaningful release, preserve a concise report with Git SHA, environment, scenario/corpus, result, and any material fairness/time-zone findings. Keep ordinary simulation outputs in Git/CI rather than Drive.

## P2 — create ADRs only when a consequential decision occurs

Status: POLICY / NO IMMEDIATE ACTION

`docs/adr/` currently contains only the local ADR template. Do not manufacture retroactive ADRs merely to populate the directory. When an architectural decision materially affects structure, quality attributes, security/trust boundaries, or is difficult to reverse, create a concise ADR using the existing template. If direction later changes, supersede rather than rewrite an accepted ADR.

## Not open work

- PR #3 event-aware scheduling/simulation integration is merged; do not repeat it.
- The July 2026 Drive project-memory tasks are historical and must not be revived automatically.
- Drive hub organization is not an engineering task tracker.
