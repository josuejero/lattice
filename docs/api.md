# API Notes

## Conventions
- JSON responses
- Error shape: `{ error: { code, message } }`
- Idempotency: reserved for later phases (Redis)

## Starter routes
- `GET /api/health`
- `GET /api/db-ping`

## Suggestions (Phase 3)

> Requires `SUGGESTIONS_ENABLED=1` to be set in the environment.

- `POST /api/orgs/:orgId/suggestions/requests` — create a request and generate ranked candidate slots.
- `GET /api/orgs/:orgId/suggestions/requests` — list recent suggestion requests for an org.
- `GET /api/orgs/:orgId/suggestions/requests/:requestId` — fetch a single request with its candidates/explanation payload.
