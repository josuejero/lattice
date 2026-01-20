# Contributing

## Quick start
1. `pnpm -w db:up`
2. `cp .env.example .env.local`
3. `pnpm -w db:migrate`
4. `pnpm -w dev`

## PR expectations
- Small PRs
- Add/update tests when behavior changes
- Run `pnpm -w lint typecheck test build` before opening PR

## Commit style
Prefer conventional commits (optional):
- feat: ...
- fix: ...
- chore: ...
- docs: ...
