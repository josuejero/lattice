# Threat Model (starter)

## Assets
- User identities
- Calendar metadata + tokens
- Availability profiles

## Threats
- Unauthorized org data access (multi-tenant isolation)
- Token leakage
- Excessive calendar permissions

## Mitigations (Phase 0/1)
- Org-scoped authorization checks
- Env/secret hygiene
- Minimal OAuth scopes
- Reduce logging of sensitive payloads
