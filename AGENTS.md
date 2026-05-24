# AGENTS.md — Bolão Trovão

World Cup 2026 betting-pool app. Users join bolões, predict match scores, and compete on a ranking. Built as a pnpm monorepo.

---

## Project Structure

```
bolao-trovao/
├── apps/
│   ├── backend/          # NestJS 10 REST API (@bolao/backend)
│   │   ├── src/
│   │   │   ├── admin/    # Admin routes (placar, ranking draft, publish)
│   │   │   ├── aposta/   # Bet upsert & read
│   │   │   ├── auth/     # JWT + Google OAuth, refresh tokens
│   │   │   ├── bolao/    # Bolão CRUD + public invite endpoint
│   │   │   ├── jogo/     # Match management
│   │   │   ├── mailer/   # Nodemailer (SMTP via Mailpit in dev)
│   │   │   ├── notificacao/  # Web Push (VAPID, optional)
│   │   │   ├── ranking/  # Bull processor + ranking table
│   │   │   └── usuario/  # User profile & password reset
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       ├── migrations/
│   │       └── seed.ts   # Creates BOLAO_GLOBAL + Fred (ADMIN) + Maria (USER)
│   └── frontend/         # Next.js 14.2 App Router (@bolao/frontend)
│       └── src/
│           ├── app/
│           │   ├── (auth)/login/   # Login page — useSearchParams needs <Suspense>
│           │   ├── (app)/          # Authenticated layout + all app pages
│           │   │   ├── palpites/   # Aposta list per user
│           │   │   ├── ranking/    # Ranking podium + list
│           │   │   ├── boloes/[id] # Bolão detail + moderator panels
│           │   │   └── admin/      # Admin dashboard (ADMIN role only)
│           │   └── convite/[codigo]/  # Public invite landing page
│           ├── components/         # Shared UI components
│           └── __tests__/          # Jest + Testing Library (15 suites)
└── packages/
    └── shared/           # @bolao/shared — TypeScript source only, no build step
        └── src/index.ts  # Shared types/constants
```

---

## Quick Start (full local stack)

```bash
# 1. Install dependencies
pnpm install

# 2. Start all services (postgres, redis, mailpit, backend, frontend)
docker compose up --build

# 3. Run DB seed (from another terminal, after backend is healthy)
cd apps/backend
$env:TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS"}'
$env:DATABASE_URL='postgresql://bolao:secret@localhost:5432/bolao_trovao'
npx ts-node prisma/seed.ts
```

Service URLs:
- Frontend: http://localhost:3000
- Backend:  http://localhost:3001
- Mailpit:  http://localhost:8025 (intercepts all outbound email)

Test credentials (created by seed):
- `fred@bolao.com` / `senha123` — ADMIN role
- `maria@bolao.com` / `senha123` — USER role

---

## Development (without Docker)

Backend:
```bash
cd apps/backend
pnpm dev          # NestJS watch mode on :3001
```

Frontend:
```bash
cd apps/frontend
pnpm dev          # Next.js on :3000
```

You still need Postgres and Redis running. The easiest way is to start only the infra services:
```bash
docker compose up postgres redis mailpit
```

---

## Testing

### Frontend (Jest + Testing Library)

```bash
cd apps/frontend
npx jest --passWithNoTests          # run all 15 suites (~56 tests)
npx jest --watch                    # watch mode
npx jest ApostaDrawer               # run single suite by name
```

Tests live in `apps/frontend/src/__tests__/`. Each file tests one component.

**Critical jest.config.ts setting** — `@bolao/shared` ships TypeScript source only (no compiled JS). The mapper must point to the source:
```ts
moduleNameMapper: {
  '^@bolao/shared$': '<rootDir>/../../packages/shared/src/index.ts',
}
```
Without this, Jest fails with "Cannot find module '@bolao/shared'".

### Backend

The backend has no Jest tests currently. Type-check with:
```bash
pnpm --filter @bolao/backend exec tsc --noEmit
```

---

## Database

```bash
cd apps/backend

# Apply pending migrations (dev)
npx prisma migrate dev

# Apply migrations (CI/production, no schema diff)
npx prisma migrate deploy

# Open Prisma Studio (GUI)
npx prisma studio

# Reset DB and re-seed (destructive)
npx prisma migrate reset --force
```

**BOLAO_GLOBAL_ID**: `00000000-0000-0000-0000-000000000001` — the global bolão every registered user joins automatically. The seed creates it; if it doesn't exist, registration will fail with a FK violation.

---

## Key Domain Constants

| Constant | Value | Meaning |
|---|---|---|
| `BOLAO_GLOBAL_ID` | `00000000-0000-0000-0000-000000000001` | Global bolão UUID |
| `MINUTOS_PRAZO_APOSTA` | `60` | Bet deadline: 60 min before kickoff |

Both are defined in `packages/shared/src/index.ts`.

---

## Architecture Notes

### Ranking Recalculation
Ranking is NOT calculated on read. Flow:
1. `PATCH /jogos/:id/placar` (admin) sets the score
2. `jogo.service.ts` enqueues a Bull job to `rankingQueue`
3. `RankingProcessor` runs `recalcularParaJogo()` and writes to the `ranking` table
4. `GET /ranking/:bolaoId` reads from the precomputed `ranking` table

**Redis is required for Bull queues.** The docker-compose sets `REDIS_URL: redis://redis:6379` for the backend. Without it, Bull falls back to `localhost` (unreachable inside the container) and all aposta/placar writes return 500 after the DB write succeeds.

### Aposta Upsert
`POST /apostas` is an upsert — no separate PATCH endpoint. Submitting a new bet for an existing (user, jogo) pair overwrites the previous prediction.

### Bet Deadline
Bets are locked `MINUTOS_PRAZO_APOSTA` (60) minutes before kickoff. Attempting to bet after the deadline returns 422.

### Auth Flow
- Short-lived access token (15 min default) + long-lived refresh token (30 days, stored in httpOnly cookie)
- Google OAuth callback: `GET /auth/google/callback`
- `ConvitePublicoController` must be registered **before** `BolaoController` in `bolao.module.ts` to avoid the JWT guard intercepting the public invite route

### Frontend — Next.js 14 Gotchas
- `useSearchParams()` must be inside a component wrapped with `<Suspense>` during static generation. Pattern used in `apps/frontend/src/app/(auth)/login/page.tsx`:
  ```tsx
  function LoginForm() { /* uses useSearchParams */ }
  export default function LoginPage() {
    return <Suspense><LoginForm /></Suspense>;
  }
  ```
- shadcn/ui v4 uses **`@base-ui/react`** (NOT Radix UI). Sheet and Dialog come from `@base-ui/react`, not `@radix-ui/react-dialog`.

---

## Code Style

- **Language**: TypeScript throughout (strict mode)
- **Backend**: NestJS modules, decorators, DTOs with class-validator
- **Frontend**: React functional components, Tailwind CSS, shadcn/ui v4
- **Design tokens**: Trovão color tokens — `trovao-base`, `trovao-card`, `trovao-gold`, `trovao-green`, `trovao-red`, `trovao-border`, `trovao-muted`, `trovao-surface`
- **No comments** unless the WHY is non-obvious
- **TDD pattern**: write failing test → verify fail → implement → verify pass → commit

### Linting
```bash
pnpm lint                        # all packages
pnpm --filter @bolao/frontend lint
pnpm --filter @bolao/backend lint
```

---

## Build

```bash
pnpm build           # builds all packages via Turborepo
```

Individual Dockerfiles are in `apps/backend/Dockerfile` and `apps/frontend/Dockerfile`. The frontend Dockerfile accepts `NEXT_PUBLIC_API_URL` as a build arg (baked into the bundle).

---

## Environment Variables

Copy `.env.example` → `.env` to override docker-compose defaults.

Key variables:

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://bolao:secret@postgres:5432/bolao_trovao` | Prisma connection |
| `REDIS_URL` | `redis://redis:6379` | Bull queue connection — **must be set** |
| `JWT_SECRET` | `local-jwt-secret-change-in-production-min32` | Change in production |
| `JWT_REFRESH_SECRET` | `local-refresh-secret-change-in-production` | Change in production |
| `GOOGLE_CLIENT_ID` | (empty) | OAuth optional |
| `GOOGLE_CLIENT_SECRET` | (empty) | OAuth optional |
| `VAPID_PUBLIC_KEY` | (empty) | Web push optional — disabled if unset |
| `APP_URL` | `http://localhost:3000` | Used in invite emails |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Baked into frontend bundle |

---

## PR Guidelines

- Title format: `[scope] brief description` — e.g., `[ranking] fix zero-point bug after placar patch`
- Required before merge: `pnpm lint` passes, `npx jest --passWithNoTests` passes
- Commit style: `feat:`, `fix:`, `chore:`, `docs:`, `test:`

---

## Common Gotchas

1. **Seed not run** → registration fails (FK on `bolaoMembro` for BOLAO_GLOBAL)
2. **REDIS_URL missing** → apostas and placar PATCHes return 500 (DB write succeeds but Bull enqueue fails)
3. **Ranking all zeros** → Bull job hasn't run yet; check Redis connectivity first
4. **`@bolao/shared` import fails in Jest** → add `moduleNameMapper` pointing to TypeScript source (see Testing section)
5. **`useSearchParams` build error** → wrap page component in `<Suspense>`
6. **PowerShell `curl`** → PowerShell's `curl` is an alias for `Invoke-WebRequest`; use `curl.exe` or the Bash tool for real curl calls
7. **Seed in Docker container** → `ts-node` not in production image; run seed locally with `DATABASE_URL` pointing to the exposed `localhost:5432`
