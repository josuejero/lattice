# Security Policy

## Reporting a vulnerability
Please do not open public issues for security reports. Send a confidential email to `security@lattice.dev` with the subject `Security issue: <brief description>` or use any private advisory channel we share.

We aim to acknowledge receipt within 3 business days and keep you updated on progress until the issue is resolved.

## What to include
- Steps to reproduce the vulnerability or a runnable demo repository.
- Impacted versions (apps/packages/commit hashes) and the severity you observe.
- Screenshots, logs, or crash reports that clarify the issue.
- Any mitigations or temporary workarounds you already tried.

## Response timeline
- **Acknowledgement:** within 3 business days.
- **Investigation:** we'll provide status updates if we expect more than a week to resolve.
- **Resolution:** we'll document the fix before making a release and confirm with you when the fix is published.

## Secrets
- Never commit `.env*` files except `.env.example`.
- Rotate any secrets or API keys immediately if they are exposed.

## Data
- Calendar tokens, availability payloads, and other personal data are considered sensitive.
- Avoid logging OAuth tokens, full calendar responses, or any personally identifiable information.
