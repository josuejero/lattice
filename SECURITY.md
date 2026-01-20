# Security Policy

## Reporting a vulnerability
Please do not open public issues for security reports.

Email: security@lattice.dev

## Secrets
- Never commit `.env*` except `.env.example`.
- Rotate keys immediately if exposed.

## Data
- Calendar tokens and availability data are considered sensitive.
- Avoid logging OAuth tokens or full calendar payloads.
