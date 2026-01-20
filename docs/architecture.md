# Architecture

## High-level
- Next.js App Router
- Route Handlers for API
- Postgres (Neon in prod)
- Redis (Upstash in prod)

## Packages
- apps/web
- packages/db
- packages/shared

## Notes
- Phase 1 adds Auth.js and org-scoped authorization.
- Phase 2 adds calendar integrations and availability normalization.
