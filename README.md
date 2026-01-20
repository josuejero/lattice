# Lattice

Privacy-respecting scheduling for groups and organizations.

## Local dev

### 1) Start services

```bash
pnpm -w db:up
```

### 2) Configure env

```bash
cp .env.example .env.local
```

### 3) Migrate DB

```bash
pnpm -w db:migrate
```

### 4) Run the app

```bash
pnpm -w dev
```

Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health)

## Scripts

* `pnpm -w lint`
* `pnpm -w typecheck`
* `pnpm -w test`
* `pnpm -w build`

## Repo layout

* `apps/web`: Next.js UI + API
* `packages/db`: Prisma client + schema
* `packages/shared`: shared types + env validation
