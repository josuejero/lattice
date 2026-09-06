# Threat model

Last reviewed: 2026-09-05

This document is maintained with the implementation. It records current assets, trust boundaries, threats, intended mitigations, residual risk, and validation needs; it does not treat intended controls as proven merely because they are documented.

## Assets

- user identities and authenticated sessions;
- organization membership, roles, and tenant-scoped application data;
- recurring availability and one-off overrides;
- scheduled events and attendee information;
- Google Calendar metadata, selected calendar identifiers, busy intervals, OAuth refresh tokens, and external event identifiers;
- audit records and integration-status metadata;
- production database, Redis/runtime state, and deployment configuration.

## Trust boundaries

- browser/client to Lattice server Route Handlers;
- authenticated user to organization-scoped data and privileged operations;
- Lattice application to Postgres/Prisma;
- Lattice application to Redis-backed infrastructure;
- Lattice application to Google OAuth and Calendar APIs;
- source repository to CI/deployment provider;
- deployed application to secret/environment configuration.

## Current threats and mitigations

### Cross-organization data access

Threat: a user reads or mutates data belonging to an organization they are not authorized to access.

Mitigations: protected organization routes use membership/role guards; relevant lookups include `orgId`; audit logging exists for important operations.

Remaining risk / validation: new routes can accidentally omit scoping. Tenant isolation must be tested as an invariant, especially for events, suggestions, Calendar selections/sync, member management, and audit visibility.

### OAuth token leakage

Threat: refresh/access tokens or other sensitive provider data are exposed through source control, Drive, logs, errors, screenshots, or database compromise.

Mitigations: refresh tokens are stored through the repository's encrypted-token flow; secrets are expected in runtime configuration; application evidence should avoid private Calendar payloads.

Remaining risk / validation: encryption and key management depend on deployment configuration. Never put `.env` files, OAuth client secrets, refresh tokens, database credentials, or production Calendar payloads into Git or the Drive project hub.

### Excessive Google Calendar permission

Threat: Lattice requests broader provider access than its supported behavior requires.

Current state: OAuth requests `calendar.readonly` and `calendar.events`. Current supported flows include calendar discovery, free/busy synchronization, and primary-calendar event creation/writeback.

Mitigation: review scopes against actual capabilities and use the narrowest set that preserves those flows.

Remaining risk / validation: do not narrow or broaden scopes without end-to-end integration testing. A permission change alters the external trust boundary and should update this threat model; use an ADR if the choice is architecturally significant.

### Calendar writeback errors or duplicates

Threat: Lattice creates an event in the wrong account/calendar, with the wrong time zone/attendees, repeats a write after retry, or reports success inconsistently with the provider.

Mitigations: writeback is feature-flagged; it requires an active connection and write scope; scheduled events record pending/success/error state and external event ID/link; attempts are audited.

Remaining risk / validation: current source was verified for event creation but not provider event update/delete or full bidirectional reconciliation. Release acceptance should use synthetic/test events and verify account, calendar, UTC/local time, attendees, duplicate/retry behavior, authorization failure, and partial-failure handling before relying on writeback as production-safe behavior.

### Calendar sync correctness and privacy

Threat: stale, missing, or incorrectly merged busy data leads to invalid suggestions, or private Calendar information is persisted/logged unnecessarily.

Mitigations: sync uses the Calendar free/busy API, selected busy-source calendars, merged UTC intervals, provider-specific busy blocks, sync-run status, and `lastSyncAt`.

Remaining risk / validation: verify selected-calendar behavior, time-zone/range boundaries, failed sync observability, and stale-data behavior. Keep provider payload detail minimized.

### Time-zone and DST errors

Threat: local-time conversion produces a wrong availability/fairness result or Calendar writeback time, particularly at daylight-saving transitions.

Mitigations: scheduling code uses zone-aware Luxon conversions and persists UTC event times with time-zone context.

Remaining risk / validation: maintain tests for DST transitions, nonexistent/repeated local times, and participants under different DST regimes; do not treat time zones as presentation-only data.

### Audit-data exposure or misleading audit semantics

Threat: the audit surface leaks tenant/sensitive data or is mistaken for proof of complete accountability when important actions are missing.

Mitigations: key Calendar operations emit audit events and the application has an audit UI.

Remaining risk / validation: define and test what the audit log is expected to prove, including actor, action, time, tenant scope, and sensitive-metadata limits.

## Threat-model maintenance triggers

Review this file when a change materially affects authentication, organizations/tenancy, OAuth/provider permissions, Calendar read/sync/writeback, public APIs, privileged dashboards/audit access, background processing, data retention, sensitive data, or a new external integration.

Routine UI-only changes do not require a full rewrite. Threat modeling should stay proportional but continuous as trust boundaries change.
