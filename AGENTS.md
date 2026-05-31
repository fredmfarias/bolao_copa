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
    └── shared/           # @bolao/shared — types/constants
        ├── src/index.ts  # Frontend consumes src (Next transpilePackages)
        └── dist/         # Backend (CommonJS require) consumes built dist — built by `predev`
```

---

## Quick Start (recommended dev flow)

Infra runs in Docker; backend + frontend run natively for instant hot-reload (Next HMR + NestJS watch). Editing app code needs no manual rebuild — at most an F5 in the browser.

```bash
# 1. First time: install deps, start infra, migrate + seed
cp .env.example .env
pnpm setup

# 2. Start backend + frontend natively (single terminal, parallel)
pnpm dev
```

Service URLs:
- Frontend: http://localhost:3000
- Backend:  http://localhost:3001
- Mailpit:  http://localhost:8025 (intercepts all outbound email)
- Postgres: localhost:5432 · Redis: localhost:6379

Test credentials (created by seed):
- `fred@bolaotrovao.com` / `senha123` — ADMIN role
- `maria@bolaotrovao.com` / `senha123` — USER role

### What to re-run after a code change
- `apps/frontend/**` → nothing (HMR).
- `apps/backend/**` → nothing (NestJS watch restarts in ~1s).
- `packages/shared/**` → restart `pnpm dev` (shared is compiled on boot via the `predev` hook; the backend consumes its built `dist`).
- `prisma/schema.prisma` → `pnpm db:migrate`.
- new deps → `pnpm install` + restart `pnpm dev`.

### Key infra/db scripts (root)
```bash
pnpm dev:infra        # postgres + redis + mailpit (detached)
pnpm dev:infra:down   # stop infra
pnpm db:migrate       # prisma migrate dev (loads root .env via dotenv-cli)
pnpm db:seed          # seed Copa 2026 data
pnpm db:reset         # destroy + recreate + seed
```

> **`pnpm dev` does NOT use Turborepo.** It uses pnpm's parallel runner
> (`pnpm --parallel --filter @bolao/backend --filter @bolao/frontend dev`) because
> the turbo Go binary fails to spawn the nvm4w `node.exe` on this Windows setup
> (`STATUS_DLL_NOT_FOUND` / `api-ms-win-core-synch-l1-2-0.dll`). `build`/`test`/`lint`
> still go through turbo.

> **Backend `.env` resolution:** `ConfigModule.forRoot({ envFilePath: ['.env', '../../.env'] })`
> loads the repo-root `.env` when the backend runs from `apps/backend`. The `db:*`
> scripts wrap Prisma with `dotenv-cli -e ../../.env` for the same reason. Inside
> Docker, env vars come from compose and take precedence (dotenv never overrides).

### Alternative: full Docker stack
Only for smoke-testing the production build (no hot-reload):
```bash
docker compose up --build -d
docker exec bolao-trovao-backend-1 sh -c "cd /app/apps/backend && npx prisma db seed"
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

Run from the repo root (these wrap Prisma with `dotenv-cli -e ../../.env` so the
root `.env` is loaded regardless of cwd):

```bash
pnpm db:migrate       # prisma migrate dev — apply pending migrations + regen client
pnpm db:reset         # destroy DB + re-seed (destructive)
pnpm db:seed          # seed only
```

Inside `apps/backend`, the equivalents are `pnpm db:migrate` / `pnpm db:deploy` /
`pnpm db:reset` / `pnpm db:seed`. For Prisma Studio:

```bash
cd apps/backend && pnpm exec dotenv -e ../../.env -- prisma studio
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
