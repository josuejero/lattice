# API notes

Last verified: 2026-09-05

Lattice uses Next.js Route Handlers under `apps/web/src/app/api/`. Handler-level OpenAPI annotations and the implementation are the endpoint authority. The application exposes an OpenAPI document through `/api/openapi` and a documentation surface at `/api-docs`.

## Conventions

- JSON responses use shared success/failure envelopes and error codes from `packages/shared`.
- Protected organization routes require authenticated organization membership and, where needed, role checks.
- Important mutating/integration routes use rate limiting, audit logging, and/or idempotency handling where implemented.
- Feature-flagged capabilities return disabled/not-found behavior when their runtime flags are off.

## Core route groups

### Health and authentication

- `GET /api/health`
- `GET /api/db-ping`
- Auth.js route under `/api/auth/[...nextauth]`

### Organizations and members

- organization collection/detail routes under `/api/orgs`
- member collection/detail routes under `/api/orgs/:orgId/members`

### Availability

- recurring template routes under `/api/orgs/:orgId/availability/me/template`
- one-off override routes under `/api/orgs/:orgId/availability/me/overrides`
- member availability read under `/api/orgs/:orgId/availability/:userId`

### Suggestions

- `POST /api/orgs/:orgId/suggestions/requests` — create a request and generate ranked candidates.
- `GET /api/orgs/:orgId/suggestions/requests` — list recent requests.
- `GET /api/orgs/:orgId/suggestions/requests/:requestId` — fetch a request/candidates.
- confirmation route under `/api/orgs/:orgId/suggestions/requests/:requestId/confirm`.

Current suggestion requests can include event-aware context introduced by the merged event-aware scheduling work. See `docs/fairness-engine.md` and the route implementation for the exact request/response contract.

### Events

- event collection/detail routes under `/api/orgs/:orgId/events`.
- Google Calendar writeback: `POST /api/orgs/:orgId/events/:eventId/writeback/google`.

### Google Calendar integration

- connection start: `/api/orgs/:orgId/integrations/google/start`
- OAuth callback: `/api/integrations/google/callback`
- calendar discovery: `/api/orgs/:orgId/integrations/google/calendars`
- organization calendar selections: `/api/orgs/:orgId/integrations/google/selections`
- free/busy synchronization: `POST /api/orgs/:orgId/integrations/google/sync`

The current integration reads selected-calendar busy time and can create confirmed events in the connected user's primary Google Calendar when writeback is enabled. Provider event update/delete was not verified in the current source.

## Contract maintenance

When an endpoint contract changes, update its handler/OpenAPI annotation and tests in the same source-control change. Do not maintain a separate Drive API specification.
