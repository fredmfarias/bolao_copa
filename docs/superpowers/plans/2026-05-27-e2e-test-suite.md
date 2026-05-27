# Suíte de Testes E2E + Integração — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a running Playwright E2E + API-integration suite covering auth, bolão/convite, aposta/prazo, pontuação/publicação, authorization/IDOR, push notifications, resilience, and wire it into CI.

**Architecture:** New `e2e/` workspace at repo root. Hybrid Page Objects (UI) + App Actions (HTTP setup). Two Playwright projects: `api` (no browser, uses `request` fixture) and `ui-chromium` (browser, reuses `storageState`). Auth uses the httpOnly `refresh_token` cookie captured into `storageState` — the frontend `AuthProvider` rehydrates the sessionStorage access token from it on mount. Async Bull queue is awaited via `expect.poll` against the admin draft endpoint (no fixed sleeps). Email assertions use the existing Mailpit REST API.

**Tech Stack:** Playwright 1.x + TypeScript, `@playwright/test`, Prisma (for edge-state seeding), Mailpit REST API, existing NestJS/Next.js apps, GitHub Actions.

---

## Reference: real endpoints & contracts (verified against source)

These are the concrete contracts the specs assert against. Do not invent others.

**Auth** (`/auth`, public unless noted):
- `POST /auth/registrar` → body `{ nome, email, senha }` (RegisterDto: nome 2-60 chars, email, senha min 8). Returns `{ message }`. Throttle 5/min.
- `POST /auth/login` → `{ email, senha }`. Returns `{ accessToken }`, sets `refresh_token` httpOnly cookie. Throttle 10/min.
- `GET /auth/confirmar-email?token=...` → returns `{ message }`.
- `POST /auth/esqueceu-senha` → `{ email }`.
- `POST /auth/nova-senha` → `{ token, senha }`.
- `POST /auth/refresh` (guard `jwt-refresh`, reads cookie) → `{ accessToken }`.
- `POST /auth/logout` → clears cookie.

**Aposta** (`/apostas`, JWT):
- `POST /apostas` → body `{ jogoId, placarCasa, placarVisitante }` (UpsertApostaDto: ints ≥ 0). Throws `403 "Prazo para apostas encerrado."` when now ≥ kickoff − 60 min. Unique per `(usuarioId, jogoId)`.
- `GET /apostas` → caller's own bets.

**Bolão** (`/boloes`, JWT) and **Convite**:
- `POST /boloes` → CreateBolaoDto `{ nome, escopo, maxParticipantes(≥10), descricao? }`. Creator becomes MODERADOR.
- `POST /boloes/:bolaoId/convite` (BolaoModeradorGuard) → `{ expiraEm? }`, returns convite with `token`.
- `GET /convites/:token` (public) → convite lookup.
- `POST /boloes/entrar/:token` (JWT) → join via invite.
- `GET /boloes/:bolaoId/apostas?jogoId=...` → `403 "Palpites disponíveis apenas após o encerramento das apostas."` before deadline; after, returns others' bets.
- `PATCH /boloes/:bolaoId/status` (RolesGuard ADMIN).

**Jogo** (`/jogos`):
- `GET /jogos?fase=...` (public), `GET /jogos/:jogoId` (public).
- `PATCH /jogos/:jogoId/placar` (JWT + ADMIN) → UpdatePlacarDto `{ placarCasa, placarVisitante }`. Enqueues Bull ranking job.

**Admin** (`/admin`, JWT + ADMIN):
- `GET /admin/boloes`, `GET /admin/ranking/:bolaoId/draft`, `GET /admin/usuarios`, `PATCH /admin/usuarios/:id` `{ role?, ativo? }`, `POST /admin/usuarios/:id/reset-senha`.

**Publicação:** `POST /admin/publicacoes` (JWT + ADMIN) → publishes round, writes RankingSnapshots.

**Ranking** (`/boloes/:bolaoId/ranking`, JWT): `GET` (`?publicacao=N`), `GET .../publicacoes`, `GET .../evolucao?usuarioId=...`.

**Notificações** (`/notificacoes`): `GET /notificacoes/vapid-public-key` (public), `POST /notificacoes/subscribe` (JWT) SubscribeDto `{ endpoint(url), p256dh, auth }`, `DELETE /notificacoes/subscribe` (JWT) `{ endpoint }`.

**Shared constants** (`@bolao/shared`): `BOLAO_GLOBAL_ID = '00000000-0000-0000-0000-000000000001'`, `MINUTOS_PRAZO_APOSTA = 60`, `BolaoEscopo`, `JogoFase`, `Role`.

**Seed admin** (from README): `admin@bolao.com` / `admin123`.

**Frontend selectors (verified):**
- `/registrar`: inputs are `input[type="text"]` (nome), `input[type="email"]`, `input[type="password"]`; submit `button` text "Cadastrar"/"Cadastrando..."; on success shows the message + link "Ir para login".
- `/login`: `input[type="email"]`, `input[type="password"]`, submit button text "Entrar"/"Entrando..."; success param shows green text "E-mail verificado com sucesso! Faça login para continuar."; labels are NOT linked via `htmlFor` — select by input `type`.
- `/auth/confirmar-email?token=...`: calls API then **redirects to `/login?emailConfirmado=true`** on success; on failure shows the error message text.
- After login the app navigates to `/jogos`.

---

## Test environment model

- A dedicated Postgres database `bolao_trovao_e2e` on the same dev Postgres instance (avoids destroying dev data).
- Infra (Postgres, Redis, Mailpit) must be up: `pnpm dev:infra`.
- `e2e/.env.e2e` holds the test env. `playwright.config.ts` loads it and starts backend (:3001) + frontend (:3000) as two `webServer` entries pointing at the test DB.
- The `pretest` script (`pnpm db:reset`) builds `@bolao/shared` and resets + seeds the test DB **before** Playwright starts the servers (so the backend readiness check on `/jogos` finds a schema).
- `global-setup.ts` waits for the backend, then generates `storageState` for the `admin` and `participante` accounts.
- Each spec file truncates dynamic tables (bolões/apostas/etc.) in `beforeAll` via `support/db.ts`, keeping reference data (seleções, estádios, jogos, bolão global, config pontuação) and the two fixture accounts intact.

---

## Phase 0 — Scaffold the e2e workspace

### Task 0.1: Create the workspace package and register it

**Files:**
- Create: `e2e/package.json`
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Read current workspace file**

Run: `type pnpm-workspace.yaml`
Confirm it lists `apps/*` and `packages/*`.

- [ ] **Step 2: Add `e2e` to the workspace**

Edit `pnpm-workspace.yaml` so the `packages:` list includes a line:
```yaml
  - 'e2e'
```
(Keep existing `apps/*` and `packages/*` entries.)

- [ ] **Step 3: Create `e2e/package.json`**

```json
{
  "name": "@bolao/e2e",
  "private": true,
  "scripts": {
    "pretest": "pnpm --filter @bolao/shared build && pnpm db:reset",
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "report": "playwright show-report",
    "db:reset": "tsx scripts/reset-db.ts"
  },
  "dependencies": {
    "@bolao/shared": "workspace:*"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@prisma/client": "5.22.0",
    "dotenv": "^16.4.5",
    "nanoid": "^3.3.7",
    "tsx": "^4.19.0",
    "typescript": "^5.7.2"
  }
}
```

> `@bolao/shared` must be built (it compiles to `dist/`) before specs that import from it run. The `pretest` script and CI's "Build shared package" step handle this.

- [ ] **Step 4: Install and download the browser**

Run: `pnpm install`
Then: `pnpm --filter @bolao/e2e exec playwright install --with-deps chromium`
Expected: install completes; Chromium downloaded.

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml e2e/package.json
git commit -m "chore(e2e): scaffold playwright workspace"
```

### Task 0.2: TypeScript + env config

**Files:**
- Create: `e2e/tsconfig.json`
- Create: `e2e/.env.e2e`
- Create: `e2e/.gitignore`

- [ ] **Step 1: Create `e2e/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["**/*.ts"]
}
```

- [ ] **Step 2: Create `e2e/.env.e2e`**

```
DATABASE_URL=postgresql://bolao:secret@localhost:5432/bolao_trovao_e2e
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=e2e-jwt-secret-at-least-32-characters-long
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=e2e-refresh-secret-at-least-32-characters-long
JWT_REFRESH_EXPIRES_IN=30d
APP_URL=http://localhost:3000
PORT=3001
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3001
# SMTP → Mailpit (host/port are what MailerService reads; no auth in dev)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=Bolão Trovão <noreply@bolao.local>
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_MAILTO=mailto:admin@bolao.local
MAILPIT_URL=http://localhost:8025
E2E_BASE_URL=http://localhost:3000
```

> `MailerService` reads `SMTP_HOST`/`SMTP_PORT` and only adds auth when `SMTP_USER`/`SMTP_PASS` are set — pointing at Mailpit's SMTP port 1025 (no auth) is exactly right for tests.

- [ ] **Step 3: Create `e2e/.gitignore`**

```
node_modules
test-results
playwright-report
.auth
```

- [ ] **Step 4: Commit**

```bash
git add e2e/tsconfig.json e2e/.env.e2e e2e/.gitignore
git commit -m "chore(e2e): typescript and env config"
```

### Task 0.3: DB reset script

**Files:**
- Create: `e2e/scripts/reset-db.ts`

- [ ] **Step 1: Create the reset script**

It creates the e2e DB if missing, runs migrations, and seeds reference data by reusing the backend's Prisma migrations and seed.

```ts
import { execSync } from 'node:child_process';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '..', '.env.e2e') });

const backend = resolve(__dirname, '..', '..', 'apps', 'backend');
const env = { ...process.env };

function run(cmd: string) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: backend, stdio: 'inherit', env });
}

// Applies all migrations to the e2e DB (creates it if absent), then seeds.
run('pnpm exec prisma migrate deploy');
run('pnpm exec prisma db seed');
console.log('e2e database ready.');
```

- [ ] **Step 2: Run it to verify the e2e DB builds**

Prereq: `pnpm dev:infra` is running.
Run: `pnpm --filter @bolao/e2e db:reset`
Expected: migrations applied to `bolao_trovao_e2e`, seed completes ("e2e database ready.").

- [ ] **Step 3: Commit**

```bash
git add e2e/scripts/reset-db.ts
git commit -m "chore(e2e): test database reset/seed script"
```

---

## Phase 1 — Playwright config, support helpers, fixtures, global setup

### Task 1.1: Support helper — Mailpit client

**Files:**
- Create: `e2e/support/mailpit.ts`

- [ ] **Step 1: Create the Mailpit helper**

```ts
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

export interface MailpitMessage {
  ID: string;
  To: { Address: string }[];
  Subject: string;
}

export const mailpit = {
  async clear(): Promise<void> {
    await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' });
  },

  async waitForMessageTo(email: string, timeoutMs = 10_000): Promise<MailpitMessage> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await fetch(`${MAILPIT_URL}/api/v1/messages`);
      const { messages } = (await res.json()) as { messages: MailpitMessage[] };
      const match = messages.find((m) => m.To.some((t) => t.Address === email));
      if (match) return match;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Nenhum e-mail para ${email} em ${timeoutMs}ms`);
  },

  async getBody(id: string): Promise<string> {
    const res = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
    const data = (await res.json()) as { HTML: string; Text: string };
    return data.HTML || data.Text;
  },

  extractConfirmToken(body: string): string {
    const match = body.match(/confirmar-email\?token=([\w.-]+)/);
    if (!match) throw new Error('Token de confirmação não encontrado no e-mail');
    return match[1];
  },

  extractResetToken(body: string): string {
    const match = body.match(/nova-senha\?token=([\w.-]+)/);
    if (!match) throw new Error('Token de redefinição não encontrado no e-mail');
    return match[1];
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add e2e/support/mailpit.ts
git commit -m "test(e2e): mailpit rest client helper"
```

> Confirmed against source: confirmation email subject is "Confirme seu e-mail — Bolão Trovão" with link `${APP_URL}/auth/confirmar-email?token=<jwt>`; reset email subject is "Recuperação de senha — Bolão Trovão" with link `${APP_URL}/auth/nova-senha?token=<jwt>`. Tokens are JWTs (contain `.`), so the `[\w.-]+` regex is correct.

### Task 1.2: Support helper — Prisma client for edge states & truncation

**Files:**
- Create: `e2e/support/db.ts`

- [ ] **Step 1: Create the DB helper**

```ts
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '..', '.env.e2e') });

export const prisma = new PrismaClient();

const GLOBAL_ID = '00000000-0000-0000-0000-000000000001';
// Fixture accounts that must survive truncation: the seeded admin and the
// participante created in global-setup (its captured session must stay valid).
const KEEP_EMAILS = ['admin@bolao.com', 'participante@test.local'];

// Wipes dynamic data while keeping reference data (selecao, estadio, jogo,
// bolao global, configuracao_pontuacao) and the fixture accounts.
//
// Uses ordered deleteMany (NOT `TRUNCATE ... CASCADE`): cascading from
// `publicacao` would also truncate `jogo` (FK jogo.publicacaoId), destroying
// reference data. We instead detach FKs first, then delete child→parent.
export async function truncateDynamic(): Promise<void> {
  // 1. Detach reference rows that point at dynamic data.
  await prisma.jogo.updateMany({ data: { publicacaoId: null, placarCasa: null, placarVisitante: null } });
  await prisma.usuario.updateMany({ data: { bolaoFavoritoId: null } });
  await prisma.configuracaoPontuacao.updateMany({ data: { atualizadoPorId: null } });

  // 2. Delete dynamic rows in FK-safe order (children first).
  await prisma.rankingSnapshot.deleteMany();
  await prisma.ranking.deleteMany();
  await prisma.aposta.deleteMany();
  await prisma.bolaoConvite.deleteMany();
  await prisma.bolaoMembro.deleteMany();
  await prisma.publicacao.deleteMany();
  await prisma.notificacaoSubscription.deleteMany();
  await prisma.bolao.deleteMany({ where: { id: { not: GLOBAL_ID } } });
  await prisma.usuario.deleteMany({ where: { email: { notIn: KEEP_EMAILS } } });
}
```

- [ ] **Step 2: Smoke-check the helper compiles & connects**

Run: `pnpm --filter @bolao/e2e exec tsx -e "import('./support/db').then(async m => { await m.truncateDynamic(); console.log('ok'); process.exit(0); })"`
Expected: prints `ok` (DB reachable, truncation valid). Prereq: Task 0.3 done.

- [ ] **Step 3: Commit**

```bash
git add e2e/support/db.ts
git commit -m "test(e2e): prisma helper for truncation and edge seeding"
```

### Task 1.3: Support helpers — queue poll & time

**Files:**
- Create: `e2e/support/time.ts`
- Create: `e2e/support/queue.ts`

- [ ] **Step 1: Create `e2e/support/time.ts`**

```ts
import { prisma } from './db';

// Returns an existing GRUPOS jogo whose kickoff is > 60 min away (bets open).
export async function jogoComApostasAbertas() {
  const limite = new Date(Date.now() + 61 * 60 * 1000);
  const jogo = await prisma.jogo.findFirst({
    where: { fase: 'GRUPOS', dataHora: { gt: limite } },
    orderBy: { dataHora: 'asc' },
  });
  if (!jogo) throw new Error('Nenhum jogo com apostas abertas no seed; ajuste o seed ou a data.');
  return jogo;
}

// Forces a jogo's kickoff to the past so the betting deadline is closed.
export async function fecharPrazoDoJogo(jogoId: string) {
  await prisma.jogo.update({
    where: { id: jogoId },
    data: { dataHora: new Date(Date.now() - 60 * 60 * 1000) },
  });
}
```

- [ ] **Step 2: Create `e2e/support/queue.ts`**

```ts
import { expect, APIRequestContext } from '@playwright/test';

// Polls the admin draft until the user's pontuacaoTotal reaches at least
// `minimo` — i.e. the Bull job has written aposta.pontuacao and the draft
// recompute reflects it. getRankingDraft returns a NUMBER (0, never null),
// so we must poll on a value, not on null. No fixed sleeps.
export async function aguardarPontuacaoDraft(
  adminApi: APIRequestContext,
  bolaoId: string,
  usuarioId: string,
  minimo = 1,
) {
  await expect
    .poll(async () => {
      const res = await adminApi.get(`/admin/ranking/${bolaoId}/draft`);
      if (!res.ok()) return -1;
      const linhas = (await res.json()) as { usuarioId: string; pontuacaoTotal: number }[];
      const linha = linhas.find((l) => l.usuarioId === usuarioId);
      return linha?.pontuacaoTotal ?? -1;
    }, { timeout: 15_000, intervals: [250, 500, 1000] })
    .toBeGreaterThanOrEqual(minimo);
}
```

- [ ] **Step 3: Commit**

```bash
git add e2e/support/time.ts e2e/support/queue.ts
git commit -m "test(e2e): time and bull-queue polling helpers"
```

> Confirmed: `GET /admin/ranking/:bolaoId/draft` returns an array of `Ranking` rows (each with `usuarioId`, `pontuacaoTotal`, `posicao`) spread with an extra `posicoesGanhas`. The endpoint recomputes synchronously on every call, so the only async wait is the Bull job writing `aposta.pontuacao` — hence we poll on the *value* (`>= minimo`), not on null.

### Task 1.4: API client (App Actions) and factories

**Files:**
- Create: `e2e/api/client.ts`
- Create: `e2e/data/factories.ts`

- [ ] **Step 1: Create `e2e/api/client.ts`**

A thin typed wrapper that registers+confirms+logs in a user and returns an authenticated `APIRequestContext` (carrying the refresh cookie) plus the user record.

```ts
import { request, APIRequestContext } from '@playwright/test';
import { prisma } from '../support/db';
import { BOLAO_GLOBAL_ID } from '@bolao/shared';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface TestUser {
  id: string;
  nome: string;
  email: string;
  senha: string;
}

// Logs in and returns a context whose every request carries the Bearer token.
// IMPORTANT: protected routes use JwtAuthGuard (Authorization header), NOT the
// refresh cookie — so we must extract accessToken from the login body and set
// it as extraHTTPHeaders. A plain post-login context (cookie only) gets 401.
async function authedContext(email: string, senha: string): Promise<APIRequestContext> {
  const anon = await request.newContext({ baseURL: BASE });
  const login = await anon.post('/auth/login', { data: { email, senha } });
  if (!login.ok()) throw new Error(`login ${email} falhou: ${login.status()} ${await login.text()}`);
  const { accessToken } = (await login.json()) as { accessToken: string };
  await anon.dispose();
  return request.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
  });
}

// Registers a user, confirms e-mail directly (fast), returns an authed context.
export async function criarUsuarioAutenticado(user: {
  nome: string; email: string; senha: string;
}): Promise<{ ctx: APIRequestContext; user: TestUser }> {
  const anon = await request.newContext({ baseURL: BASE });
  const reg = await anon.post('/auth/registrar', {
    data: { nome: user.nome, email: user.email, senha: user.senha },
  });
  if (!reg.ok()) throw new Error(`registrar falhou: ${reg.status()} ${await reg.text()}`);
  await anon.dispose();

  const dbUser = await prisma.usuario.update({
    where: { email: user.email },
    data: { emailVerificado: true },
  });

  const ctx = await authedContext(user.email, user.senha);
  return { ctx, user: { id: dbUser.id, nome: user.nome, email: user.email, senha: user.senha } };
}

// Authenticated context for the seeded admin.
export async function adminContext(): Promise<APIRequestContext> {
  return authedContext('admin@bolao.com', 'admin123');
}

export { BOLAO_GLOBAL_ID, BASE };
```

- [ ] **Step 2: Create `e2e/data/factories.ts`**

```ts
import { nanoid } from 'nanoid';

export function newUser(prefix = 'user') {
  const id = nanoid(8).toLowerCase();
  const worker = process.env.TEST_WORKER_INDEX ?? '0';
  return {
    nome: `Teste ${id}`,
    email: `${prefix}-${worker}-${id}@test.local`,
    senha: 'senha12345',
  };
}

export function newBolao() {
  const id = nanoid(6);
  return { nome: `Bolão ${id}`, escopo: 'AMBOS' as const, maxParticipantes: 10 };
}
```

- [ ] **Step 3: Verify factories compile**

Run: `pnpm --filter @bolao/e2e exec tsx -e "import('./data/factories').then(m => { console.log(m.newUser().email); })"`
Expected: prints an email like `user-0-xxxxxxxx@test.local`.

- [ ] **Step 4: Commit**

```bash
git add e2e/api/client.ts e2e/data/factories.ts
git commit -m "test(e2e): api app-actions client and data factories"
```

### Task 1.5: Playwright config + global setup/teardown + role storageState

**Files:**
- Create: `e2e/playwright.config.ts`
- Create: `e2e/global-setup.ts`
- Create: `e2e/global-teardown.ts`

- [ ] **Step 1: Create `e2e/global-setup.ts`**

Resets the DB, then logs in admin + a participante in a browser context to capture the `refresh_token` cookie into `storageState` files.

> The DB is reset by the `pretest` script (`pnpm db:reset`) **before** Playwright starts — so the schema exists before the backend `webServer` readiness check hits `/jogos`. This global-setup only waits for the backend and captures sessions; it does not reset the DB.

```ts
import { chromium, request, FullConfig } from '@playwright/test';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '.env.e2e') });

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Poll the backend until it answers, so this setup doesn't depend on whether
// Playwright starts webServer before or after globalSetup.
async function waitForBackend(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/jogos`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Backend não respondeu em ${BASE}/jogos dentro de ${timeoutMs}ms`);
}

async function saveSession(email: string, senha: string, file: string) {
  // Log in via API inside a browser context so the httpOnly refresh cookie is
  // captured into storageState; the UI's AuthProvider rehydrates from it.
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const res = await context.request.post(`${BASE}/auth/login`, { data: { email, senha } });
  if (!res.ok()) throw new Error(`login ${email} falhou: ${res.status()}`);
  await context.storageState({ path: file });
  await browser.close();
}

export default async function globalSetup(_config: FullConfig) {
  // 1. Wait for the backend (DB already reset by the pretest script).
  await waitForBackend();

  // 2. Create a non-admin participante (confirmed) for ui tests.
  const ctx = await request.newContext({ baseURL: BASE });
  await ctx.post('/auth/registrar', {
    data: { nome: 'Participante E2E', email: 'participante@test.local', senha: 'senha12345' },
  });
  await ctx.dispose();
  // Mark e-mail confirmed directly (skips the Mailpit round-trip for setup).
  const { prisma } = await import('./support/db');
  await prisma.usuario.update({ where: { email: 'participante@test.local' }, data: { emailVerificado: true } });

  // 3. Capture sessions.
  await saveSession('admin@bolao.com', 'admin123', resolve(__dirname, '.auth/admin.json'));
  await saveSession('participante@test.local', 'senha12345', resolve(__dirname, '.auth/participante.json'));
}
```

- [ ] **Step 2: Create `e2e/global-teardown.ts`**

```ts
export default async function globalTeardown() {
  const { prisma } = await import('./support/db');
  await prisma.$disconnect();
}
```

- [ ] **Step 3: Create `e2e/playwright.config.ts`**

Two `webServer` entries start backend & frontend against the e2e env. Two projects: `api` and `ui-chromium`.

```ts
import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '.env.e2e') });

const ROOT = resolve(__dirname, '..');

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'api', testMatch: /tests\/(authz|aposta|ranking|notificacoes)\/.*\.api\.spec\.ts/ },
    {
      name: 'ui-chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /\.api\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @bolao/backend dev',
      cwd: ROOT,
      url: 'http://localhost:3001/jogos',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { ...process.env },
    },
    {
      command: 'pnpm --filter @bolao/frontend dev',
      cwd: ROOT,
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { ...process.env },
    },
  ],
});
```

- [ ] **Step 4: Smoke test — a trivial spec that boots the servers**

Create `e2e/tests/smoke.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('home redirects to login', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});
```

- [ ] **Step 5: Run the smoke test**

Prereq: `pnpm dev:infra` running.
Run: `pnpm --filter @bolao/e2e test smoke.spec.ts --project=ui-chromium`
Expected: PASS — servers boot, DB resets, login button visible.

- [ ] **Step 6: Commit**

```bash
git add e2e/playwright.config.ts e2e/global-setup.ts e2e/global-teardown.ts e2e/tests/smoke.spec.ts
git commit -m "test(e2e): playwright config, global setup, role sessions, smoke test"
```

### Task 1.6: Shared test fixtures

**Files:**
- Create: `e2e/fixtures/index.ts`

- [ ] **Step 1: Create the extended `test` with fixtures**

```ts
import { test as base, expect, APIRequestContext, request } from '@playwright/test';
import { adminContext } from '../api/client';

type Fixtures = {
  adminApi: APIRequestContext;
  anonApi: APIRequestContext;
};

export const test = base.extend<Fixtures>({
  adminApi: async ({}, use) => {
    const ctx = await adminContext();
    await use(ctx);
    await ctx.dispose();
  },
  anonApi: async ({}, use) => {
    const ctx = await request.newContext({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001' });
    await use(ctx);
    await ctx.dispose();
  },
});

export { expect };
```

- [ ] **Step 2: Commit**

```bash
git add e2e/fixtures/index.ts
git commit -m "test(e2e): shared adminApi/anonApi fixtures"
```

---

## Phase 2 — Auth flows

### Task 2.1: Page Objects for auth UI

**Files:**
- Create: `e2e/pages/registro.page.ts`
- Create: `e2e/pages/login.page.ts`

- [ ] **Step 1: Create `e2e/pages/registro.page.ts`**

```ts
import { Page, expect } from '@playwright/test';

export class RegistroPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/registrar');
  }

  async register(nome: string, email: string, senha: string) {
    await this.page.locator('input[type="text"]').fill(nome);
    await this.page.locator('input[type="email"]').fill(email);
    await this.page.locator('input[type="password"]').fill(senha);
    await this.page.getByRole('button', { name: /cadastrar/i }).click();
  }

  async expectSuccess() {
    await expect(this.page.getByRole('link', { name: 'Ir para login' })).toBeVisible();
  }
}
```

- [ ] **Step 2: Create `e2e/pages/login.page.ts`**

```ts
import { Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, senha: string) {
    await this.page.locator('input[type="email"]').fill(email);
    await this.page.locator('input[type="password"]').fill(senha);
    await this.page.getByRole('button', { name: 'Entrar' }).click();
  }

  async expectLoggedIn() {
    await expect(this.page).toHaveURL(/\/jogos/);
  }

  async expectError() {
    await expect(this.page.locator('p.text-red-400')).toBeVisible();
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add e2e/pages/registro.page.ts e2e/pages/login.page.ts
git commit -m "test(e2e): auth page objects"
```

### Task 2.2: E2E — registro → confirmação de e-mail → login

**Files:**
- Create: `e2e/tests/auth/registro-confirmacao.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';
import { mailpit } from '../../support/mailpit';
import { truncateDynamic } from '../../support/db';
import { newUser } from '../../data/factories';
import { RegistroPage } from '../../pages/registro.page';
import { LoginPage } from '../../pages/login.page';

test.describe('Registro → confirmação → login', () => {
  test.beforeAll(async () => { await truncateDynamic(); });
  test.beforeEach(async () => { await mailpit.clear(); });

  test('usuário se registra, confirma e-mail e faz login', async ({ page }) => {
    const user = newUser();

    // 1. Registro pela UI
    const registro = new RegistroPage(page);
    await registro.goto();
    await registro.register(user.nome, user.email, user.senha);
    await registro.expectSuccess();

    // 2. E-mail de confirmação chega no Mailpit
    //    (template = "Confirme seu e-mail — Bolão Trovão"; corpo contém só o link,
    //     não o nome do usuário — não asserir nome aqui)
    const msg = await mailpit.waitForMessageTo(user.email);
    expect(msg.Subject).toMatch(/confirme seu e-mail/i);
    const body = await mailpit.getBody(msg.ID);
    expect(body).toContain('/auth/confirmar-email?token=');
    const token = mailpit.extractConfirmToken(body);

    // 3. Navega no link → app confirma e redireciona ao login com aviso verde
    await page.goto(`/auth/confirmar-email?token=${token}`);
    await expect(page).toHaveURL(/\/login\?emailConfirmado=true/);
    await expect(page.getByText('E-mail verificado com sucesso! Faça login para continuar.')).toBeVisible();

    // 4. Login completa o fluxo
    const login = new LoginPage(page);
    await login.login(user.email, user.senha);
    await login.expectLoggedIn();
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `pnpm --filter @bolao/e2e test auth/registro-confirmacao.spec.ts --project=ui-chromium`
Expected: PASS. (If the email subject/link path differs, fix the `mailpit` regex/subject assertion against the real template, then re-run.)

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/auth/registro-confirmacao.spec.ts
git commit -m "test(e2e): registro→confirmação→login flow"
```

### Task 2.3: E2E — recuperação de senha

**Files:**
- Create: `e2e/tests/auth/recuperacao-senha.spec.ts`

- [ ] **Step 1: Write the spec**

(Reset link path `${APP_URL}/auth/nova-senha?token=<jwt>` is confirmed; `extractResetToken` already matches it.)

> Use the `anonApi` fixture (targets `:3001`) — the built-in `request` fixture inherits `use.baseURL` (the frontend `:3000`) and would hit Next.js instead of the API.

```ts
import { test, expect } from '../../fixtures';
import { mailpit } from '../../support/mailpit';
import { truncateDynamic, prisma } from '../../support/db';
import { newUser } from '../../data/factories';
import { LoginPage } from '../../pages/login.page';

test.describe('Recuperação de senha', () => {
  test.beforeAll(async () => { await truncateDynamic(); });
  test.beforeEach(async () => { await mailpit.clear(); });

  test('usuário solicita reset, define nova senha e loga', async ({ page, anonApi }) => {
    const user = newUser();
    await anonApi.post('/auth/registrar', { data: user });
    await prisma.usuario.update({ where: { email: user.email }, data: { emailVerificado: true } });

    // Solicita reset
    const esqueceu = await anonApi.post('/auth/esqueceu-senha', { data: { email: user.email } });
    expect(esqueceu.ok()).toBeTruthy();

    // Extrai token do e-mail e define nova senha via API
    const msg = await mailpit.waitForMessageTo(user.email);
    const token = mailpit.extractResetToken(await mailpit.getBody(msg.ID));
    const novaSenha = 'novaSenha123';
    const nova = await anonApi.post('/auth/nova-senha', { data: { token, senha: novaSenha } });
    expect(nova.ok()).toBeTruthy();

    // Loga com a nova senha pela UI
    const login = new LoginPage(page);
    await login.goto();
    await login.login(user.email, novaSenha);
    await login.expectLoggedIn();
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `pnpm --filter @bolao/e2e test auth/recuperacao-senha.spec.ts --project=ui-chromium`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/auth/recuperacao-senha.spec.ts e2e/support/mailpit.ts
git commit -m "test(e2e): recuperação de senha flow"
```

---

## Phase 3 — Bolão + convite

### Task 3.1: API — criar bolão e ingresso via convite

**Files:**
- Create: `e2e/tests/bolao/convite.api.spec.ts`

- [ ] **Step 1: Add convite spec to the `api` project glob**

Edit `e2e/playwright.config.ts` `api` project `testMatch` to also match `bolao`:
```ts
{ name: 'api', testMatch: /tests\/(authz|aposta|ranking|notificacoes|bolao)\/.*\.api\.spec\.ts/ },
```

- [ ] **Step 2: Write the spec**

```ts
import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado } from '../../api/client';
import { truncateDynamic } from '../../support/db';
import { newUser, newBolao } from '../../data/factories';
import { BolaoMembroPapel } from '@bolao/shared';

test.describe('Bolão + convite (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('criador vira MODERADOR e segundo usuário entra via convite', async () => {
    const dono = await criarUsuarioAutenticado(newUser('dono'));
    const bolaoData = newBolao();

    // Cria bolão
    const criar = await dono.ctx.post('/boloes', { data: bolaoData });
    expect(criar.ok()).toBeTruthy();
    const bolao = await criar.json();

    // Gera convite (moderador)
    const conviteRes = await dono.ctx.post(`/boloes/${bolao.id}/convite`, { data: {} });
    expect(conviteRes.ok()).toBeTruthy();
    const convite = await conviteRes.json();
    expect(convite.token).toBeTruthy();

    // Lookup público do convite
    const lookup = await dono.ctx.get(`/convites/${convite.token}`);
    expect(lookup.ok()).toBeTruthy();

    // Segundo usuário entra via convite
    const membro = await criarUsuarioAutenticado(newUser('membro'));
    const entrar = await membro.ctx.post(`/boloes/entrar/${convite.token}`);
    expect(entrar.ok()).toBeTruthy();

    // Bolão lista os 2 membros
    const obter = await dono.ctx.get(`/boloes/${bolao.id}`);
    const detalhe = await obter.json();
    const papeis = detalhe.membros.map((m: any) => `${m.usuarioId}:${m.papel}`);
    expect(papeis).toContain(`${dono.user.id}:${BolaoMembroPapel.MODERADOR}`);
    expect(detalhe.membros.some((m: any) => m.usuarioId === membro.user.id)).toBeTruthy();

    await dono.ctx.dispose();
    await membro.ctx.dispose();
  });
});
```

- [ ] **Step 3: Run the spec**

Run: `pnpm --filter @bolao/e2e test bolao/convite.api.spec.ts --project=api`
Expected: PASS. (Confirmed: `GET /boloes/:id` returns the bolão with `membros[]`, each having `usuarioId`, `papel`, and nested `usuario`.)

- [ ] **Step 4: Commit**

```bash
git add e2e/playwright.config.ts e2e/tests/bolao/convite.api.spec.ts
git commit -m "test(e2e): bolão creation + invite join (api)"
```

### Task 3.2: API — ingresso automático no bolão global

**Files:**
- Create: `e2e/tests/bolao/bolao-global.api.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado, BOLAO_GLOBAL_ID } from '../../api/client';
import { truncateDynamic, prisma } from '../../support/db';
import { newUser } from '../../data/factories';

test.describe('Bolão global (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('novo usuário confirmado já é membro do bolão global com Ranking', async () => {
    const { user, ctx } = await criarUsuarioAutenticado(newUser('global'));

    const membro = await prisma.bolaoMembro.findUnique({
      where: { bolaoId_usuarioId: { bolaoId: BOLAO_GLOBAL_ID, usuarioId: user.id } },
    });
    expect(membro).not.toBeNull();

    const ranking = await prisma.ranking.findUnique({
      where: { bolaoId_usuarioId: { bolaoId: BOLAO_GLOBAL_ID, usuarioId: user.id } },
    });
    expect(ranking).not.toBeNull();

    await ctx.dispose();
  });
});
```

- [ ] **Step 2: Run the spec**

(Confirmed: `auth.service.registrar` creates the `BOLAO_GLOBAL_ID` membership + `Ranking` at registration time, before e-mail confirmation.)
Run: `pnpm --filter @bolao/e2e test bolao/bolao-global.api.spec.ts --project=api`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/bolao/bolao-global.api.spec.ts
git commit -m "test(e2e): auto-join global bolão (api)"
```

---

## Phase 4 — Aposta + prazo

### Task 4.1: API — upsert de palpite (substitui, não duplica)

**Files:**
- Create: `e2e/tests/aposta/upsert-palpite.api.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado } from '../../api/client';
import { truncateDynamic, prisma } from '../../support/db';
import { newUser } from '../../data/factories';
import { jogoComApostasAbertas } from '../../support/time';

test.describe('Aposta upsert (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('reenvio substitui o palpite sem duplicar', async () => {
    const { user, ctx } = await criarUsuarioAutenticado(newUser('aposta'));
    const jogo = await jogoComApostasAbertas();

    const a1 = await ctx.post('/apostas', { data: { jogoId: jogo.id, placarCasa: 1, placarVisitante: 0 } });
    expect(a1.ok()).toBeTruthy();

    const a2 = await ctx.post('/apostas', { data: { jogoId: jogo.id, placarCasa: 2, placarVisitante: 2 } });
    expect(a2.ok()).toBeTruthy();

    const apostas = await prisma.aposta.findMany({ where: { usuarioId: user.id, jogoId: jogo.id } });
    expect(apostas).toHaveLength(1);
    expect(apostas[0].placarCasa).toBe(2);
    expect(apostas[0].placarVisitante).toBe(2);

    await ctx.dispose();
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `pnpm --filter @bolao/e2e test aposta/upsert-palpite.api.spec.ts --project=api`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/aposta/upsert-palpite.api.spec.ts
git commit -m "test(e2e): aposta upsert replaces without duplicating (api)"
```

### Task 4.2: API — bloqueio após o prazo

**Files:**
- Create: `e2e/tests/aposta/prazo.api.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado } from '../../api/client';
import { truncateDynamic, prisma } from '../../support/db';
import { newUser } from '../../data/factories';
import { jogoComApostasAbertas, fecharPrazoDoJogo } from '../../support/time';

test.describe('Aposta prazo (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('apostar após o prazo retorna 403 e não cria aposta', async () => {
    const { user, ctx } = await criarUsuarioAutenticado(newUser('prazo'));
    const jogo = await jogoComApostasAbertas();
    await fecharPrazoDoJogo(jogo.id);

    const res = await ctx.post('/apostas', { data: { jogoId: jogo.id, placarCasa: 1, placarVisitante: 1 } });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.message).toBe('Prazo para apostas encerrado.');

    const count = await prisma.aposta.count({ where: { usuarioId: user.id, jogoId: jogo.id } });
    expect(count).toBe(0);

    await ctx.dispose();
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `pnpm --filter @bolao/e2e test aposta/prazo.api.spec.ts --project=api`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/aposta/prazo.api.spec.ts
git commit -m "test(e2e): aposta blocked after deadline (api)"
```

---

## Phase 5 — Pontuação + publicação

### Task 5.1: API — cálculo draft após placar (fila Bull)

**Files:**
- Create: `e2e/tests/ranking/calculo-draft.api.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado, BOLAO_GLOBAL_ID } from '../../api/client';
import { truncateDynamic } from '../../support/db';
import { newUser } from '../../data/factories';
import { jogoComApostasAbertas } from '../../support/time';
import { aguardarPontuacaoDraft } from '../../support/queue';

test.describe('Cálculo de ranking draft (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('placar registrado dispara cálculo e popula o draft', async ({ adminApi }) => {
    const apostador = await criarUsuarioAutenticado(newUser('calc'));
    const jogo = await jogoComApostasAbertas();

    // Palpite exato 2x1
    await apostador.ctx.post('/apostas', { data: { jogoId: jogo.id, placarCasa: 2, placarVisitante: 1 } });

    // Admin registra o mesmo placar → enfileira job
    const placar = await adminApi.patch(`/jogos/${jogo.id}/placar`, { data: { placarCasa: 2, placarVisitante: 1 } });
    expect(placar.ok()).toBeTruthy();

    // Aguarda Bull concluir e checa pontuação > 0 no draft do bolão global
    await aguardarPontuacaoDraft(adminApi, BOLAO_GLOBAL_ID, apostador.user.id);

    const draft = await adminApi.get(`/admin/ranking/${BOLAO_GLOBAL_ID}/draft`);
    const linhas = await draft.json();
    const linha = linhas.find((l: any) => l.usuarioId === apostador.user.id);
    expect(linha.pontuacaoTotal).toBeGreaterThan(0);

    await apostador.ctx.dispose();
  });
});
```

- [ ] **Step 2: Run the spec**

Prereq: Redis up (part of `pnpm dev:infra`).
Run: `pnpm --filter @bolao/e2e test ranking/calculo-draft.api.spec.ts --project=api`
Expected: PASS. (Confirmed: `getRankingDraft` calls `recalcularRankingBolao` then returns an array of `Ranking` rows spread with `posicoesGanhas` — each row has `usuarioId` and `pontuacaoTotal`.)

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/ranking/calculo-draft.api.spec.ts
git commit -m "test(e2e): bull queue computes ranking draft after placar (api)"
```

### Task 5.2: API — publicação congela snapshot

**Files:**
- Create: `e2e/tests/ranking/publicacao-snapshot.api.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado, BOLAO_GLOBAL_ID } from '../../api/client';
import { truncateDynamic, prisma } from '../../support/db';
import { newUser } from '../../data/factories';
import { jogoComApostasAbertas } from '../../support/time';
import { aguardarPontuacaoDraft } from '../../support/queue';

test.describe('Publicação de ranking (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('publicar grava RankingSnapshot e participante vê o congelado', async ({ adminApi }) => {
    const apostador = await criarUsuarioAutenticado(newUser('pub'));
    const jogo = await jogoComApostasAbertas();
    await apostador.ctx.post('/apostas', { data: { jogoId: jogo.id, placarCasa: 1, placarVisitante: 0 } });
    await adminApi.patch(`/jogos/${jogo.id}/placar`, { data: { placarCasa: 1, placarVisitante: 0 } });
    await aguardarPontuacaoDraft(adminApi, BOLAO_GLOBAL_ID, apostador.user.id);

    // Publica
    const pub = await adminApi.post('/admin/publicacoes');
    expect(pub.ok()).toBeTruthy();

    // Snapshot gravado
    const snap = await prisma.rankingSnapshot.findFirst({
      where: { bolaoId: BOLAO_GLOBAL_ID, usuarioId: apostador.user.id },
    });
    expect(snap).not.toBeNull();
    expect(snap!.pontuacaoTotal).toBeGreaterThan(0);

    // Participante lê o ranking publicado (snapshot congelado)
    const ranking = await apostador.ctx.get(`/boloes/${BOLAO_GLOBAL_ID}/ranking`);
    expect(ranking.ok()).toBeTruthy();
    const linhas = await ranking.json();
    expect(linhas.some((l: any) => l.usuarioId === apostador.user.id)).toBeTruthy();

    await apostador.ctx.dispose();
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `pnpm --filter @bolao/e2e test ranking/publicacao-snapshot.api.spec.ts --project=api`
Expected: PASS. (Align ranking response field names with `ranking.service.obterRanking` if needed.)

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/ranking/publicacao-snapshot.api.spec.ts
git commit -m "test(e2e): publicação freezes snapshot (api)"
```

---

## Phase 6 — Autorização / IDOR

### Task 6.1: API — usuário comum não acessa endpoints de admin

**Files:**
- Create: `e2e/tests/authz/admin-endpoints.api.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado } from '../../api/client';
import { truncateDynamic } from '../../support/db';
import { newUser } from '../../data/factories';

test.describe('Authz — endpoints de admin (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  const rotasAdmin: { method: 'get' | 'post' | 'patch'; path: string; data?: any }[] = [
    { method: 'get', path: '/admin/boloes' },
    { method: 'get', path: '/admin/usuarios' },
    { method: 'post', path: '/admin/publicacoes' },
  ];

  test('USER recebe 403 em rotas /admin/*', async () => {
    const { ctx } = await criarUsuarioAutenticado(newUser('naoadmin'));
    for (const rota of rotasAdmin) {
      const res = rota.method === 'get'
        ? await ctx.get(rota.path)
        : rota.method === 'post'
          ? await ctx.post(rota.path, { data: rota.data ?? {} })
          : await ctx.patch(rota.path, { data: rota.data ?? {} });
      expect(res.status(), `${rota.method} ${rota.path}`).toBe(403);
    }
    await ctx.dispose();
  });

  test('anônimo recebe 401 em rotas /admin/*', async ({ anonApi }) => {
    const res = await anonApi.get('/admin/usuarios');
    expect(res.status()).toBe(401);
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `pnpm --filter @bolao/e2e test authz/admin-endpoints.api.spec.ts --project=api`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/authz/admin-endpoints.api.spec.ts
git commit -m "test(e2e): authz on admin endpoints (api)"
```

### Task 6.2: API — palpite de outro oculto antes do prazo; sem edição cruzada

**Files:**
- Create: `e2e/tests/authz/apostas-cruzadas.api.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado, BOLAO_GLOBAL_ID } from '../../api/client';
import { truncateDynamic, prisma } from '../../support/db';
import { newUser } from '../../data/factories';
import { jogoComApostasAbertas } from '../../support/time';

test.describe('Authz — apostas entre usuários (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('palpites do jogo ocultos antes do prazo', async () => {
    const a = await criarUsuarioAutenticado(newUser('a'));
    const b = await criarUsuarioAutenticado(newUser('b'));
    const jogo = await jogoComApostasAbertas();
    await b.ctx.post('/apostas', { data: { jogoId: jogo.id, placarCasa: 3, placarVisitante: 0 } });

    // A tenta ver palpites do jogo no bolão global antes do prazo → 403
    const res = await a.ctx.get(`/boloes/${BOLAO_GLOBAL_ID}/apostas?jogoId=${jogo.id}`);
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.message).toBe('Palpites disponíveis apenas após o encerramento das apostas.');

    await a.ctx.dispose();
    await b.ctx.dispose();
  });

  test('GET /apostas retorna apenas as apostas do próprio usuário', async () => {
    const a = await criarUsuarioAutenticado(newUser('a2'));
    const b = await criarUsuarioAutenticado(newUser('b2'));
    const jogo = await jogoComApostasAbertas();
    await a.ctx.post('/apostas', { data: { jogoId: jogo.id, placarCasa: 1, placarVisitante: 1 } });
    await b.ctx.post('/apostas', { data: { jogoId: jogo.id, placarCasa: 2, placarVisitante: 2 } });

    const res = await a.ctx.get('/apostas');
    const apostas = await res.json();
    const usuarioIds: string[] = apostas.map((x: any) => x.usuarioId);
    expect(usuarioIds.every((id) => id === a.user.id)).toBeTruthy();
    expect(usuarioIds).not.toContain(b.user.id);

    await a.ctx.dispose();
    await b.ctx.dispose();
  });

  test('usuário inativo é bloqueado no login', async () => {
    const { user } = await criarUsuarioAutenticado(newUser('inativo'));
    await prisma.usuario.update({ where: { id: user.id }, data: { ativo: false } });
    const { request } = await import('@playwright/test');
    const anon = await request.newContext({ baseURL: process.env.NEXT_PUBLIC_API_URL });
    const res = await anon.post('/auth/login', { data: { email: user.email, senha: 'senha12345' } });
    expect(res.status()).toBe(401); // auth.service.login lança "Sua conta está desativada."
    const body = await res.json();
    expect(body.message).toBe('Sua conta está desativada.');
    await anon.dispose();
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `pnpm --filter @bolao/e2e test authz/apostas-cruzadas.api.spec.ts --project=api`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/authz/apostas-cruzadas.api.spec.ts
git commit -m "test(e2e): authz for cross-user bets and inactive login (api)"
```

---

## Phase 7 — Push notifications

### Task 7.1: API — ciclo subscribe/unsubscribe + guard

**Files:**
- Create: `e2e/tests/notificacoes/push-subscribe.api.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado } from '../../api/client';
import { truncateDynamic, prisma } from '../../support/db';
import { newUser } from '../../data/factories';

test.describe('Push subscribe (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('subscribe cria subscription e unsubscribe remove', async () => {
    const { user, ctx } = await criarUsuarioAutenticado(newUser('push'));
    const endpoint = `https://push.example.com/${user.id}`;

    const sub = await ctx.post('/notificacoes/subscribe', {
      data: { endpoint, p256dh: 'chave-p256dh', auth: 'chave-auth' },
    });
    expect(sub.ok()).toBeTruthy();

    let row = await prisma.notificacaoSubscription.findUnique({ where: { endpoint } });
    expect(row).not.toBeNull();

    const unsub = await ctx.delete('/notificacoes/subscribe', { data: { endpoint } });
    expect(unsub.ok()).toBeTruthy();

    row = await prisma.notificacaoSubscription.findUnique({ where: { endpoint } });
    expect(row).toBeNull();

    await ctx.dispose();
  });

  test('subscribe sem token retorna 401', async ({ anonApi }) => {
    const res = await anonApi.post('/notificacoes/subscribe', {
      data: { endpoint: 'https://push.example.com/anon', p256dh: 'x', auth: 'y' },
    });
    expect(res.status()).toBe(401);
  });

  test('vapid-public-key é público', async ({ anonApi }) => {
    const res = await anonApi.get('/notificacoes/vapid-public-key');
    expect(res.ok()).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `pnpm --filter @bolao/e2e test notificacoes/push-subscribe.api.spec.ts --project=api`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/notificacoes/push-subscribe.api.spec.ts
git commit -m "test(e2e): push subscribe/unsubscribe lifecycle (api)"
```

### Task 7.2: UI — concessão de permissão de notificações

**Files:**
- Create: `e2e/tests/notificacoes/push-permissao.spec.ts`

- [ ] **Step 1: Find the UI control that triggers subscription**

Run: `findstr /S /I "subscribe vapid-public-key Notification.requestPermission ativar notific" apps\frontend\src`
Note the page/route and the button label/text that triggers `POST /notificacoes/subscribe`.

- [ ] **Step 2: Write the spec using the participante session and granted permission**

```ts
import { test as base, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { truncateDynamic } from '../../support/db';

// Use the pre-captured participante session + grant notifications permission.
const test = base.extend({
  context: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: resolve(__dirname, '..', '..', '.auth', 'participante.json'),
      permissions: ['notifications'],
    });
    await use(context);
    await context.close();
  },
});

test.beforeAll(async () => { await truncateDynamic(); });

// NOTE: replace ROUTE and BUTTON_TEXT with the values found in Step 1.
test.skip('ativar notificações cria subscription', async ({ page }) => {
  const subscribePromise = page.waitForResponse(
    (r) => r.url().includes('/notificacoes/subscribe') && r.request().method() === 'POST',
  );
  await page.goto('/configuracoes'); // ROUTE from Step 1
  await page.getByRole('button', { name: /ativar notifica/i }).click(); // BUTTON_TEXT from Step 1
  const res = await subscribePromise;
  expect(res.status()).toBeLessThan(400);
});
```

- [ ] **Step 3: Replace placeholders & un-skip**

Using Step 1's findings, set the real route and button text, change `test.skip` → `test`. If the frontend has no UI control to subscribe (push only wired in a service worker), delete this UI test and keep only Task 7.1 — record the decision in the commit message.

- [ ] **Step 4: Run the spec**

Run: `pnpm --filter @bolao/e2e test notificacoes/push-permissao.spec.ts --project=ui-chromium`
Expected: PASS (or test removed per Step 3).

- [ ] **Step 5: Commit**

```bash
git add e2e/tests/notificacoes/push-permissao.spec.ts
git commit -m "test(e2e): push permission grant via UI"
```

### Task 7.3: Backend integration — envio de push mockado

**Files:**
- Create: `apps/backend/src/notificacao/notificacao.service.push.spec.ts`

Confirmed contract (from `notificacao.service.ts`): the send method is `enviarParaUsuario(usuarioId: string, payload: object)`. It returns early when VAPID is not configured (`!!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)`), then for each subscription calls `webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, JSON.stringify(payload))`. The `ConfigService` mock returning `'fake'` for all keys makes `vapidConfigured` true, and `jest.mock('web-push')` stubs `setVapidDetails` so the constructor won't throw.

- [ ] **Step 1: Write the spec (runs in the existing backend Jest/ts-jest project)**

```ts
import { Test } from '@nestjs/testing';
import * as webpush from 'web-push';
import { NotificacaoService } from './notificacao.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

jest.mock('web-push');

describe('NotificacaoService — envio (mocked web-push)', () => {
  let service: NotificacaoService;
  const prisma = {
    notificacaoSubscription: {
      findMany: jest.fn().mockResolvedValue([
        { endpoint: 'https://push.example.com/1', p256dh: 'p', auth: 'a' },
      ]),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificacaoService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => 'fake' } },
      ],
    }).compile();
    service = moduleRef.get(NotificacaoService);
  });

  it('chama sendNotification com a subscription e payload serializado', async () => {
    (webpush.sendNotification as jest.Mock).mockResolvedValue({});
    const payload = { title: 'Jogo começou', body: 'x', jogoId: 'jogo-1' };

    await service.enviarParaUsuario('user-id', payload);

    expect(prisma.notificacaoSubscription.findMany).toHaveBeenCalledWith({ where: { usuarioId: 'user-id' } });
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint: 'https://push.example.com/1', keys: { p256dh: 'p', auth: 'a' } },
      JSON.stringify(payload),
    );
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `pnpm --filter @bolao/backend test -- notificacao.service.push.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/notificacao/notificacao.service.push.spec.ts
git commit -m "test(backend): push send invokes web-push (mocked)"
```

---

## Phase 8 — Resiliência

### Task 8.1: UI — falha de rede mostra erro amigável

**Files:**
- Create: `e2e/tests/resiliencia/falha-de-rede.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';
import { truncateDynamic } from '../../support/db';
import { LoginPage } from '../../pages/login.page';

test.beforeAll(async () => { await truncateDynamic(); });

test('falha de rede no login exibe mensagem de erro, não tela branca', async ({ page }) => {
  await page.route('**/auth/login', (route) => route.abort());
  const login = new LoginPage(page);
  await login.goto();
  await login.login('qualquer@test.local', 'senha12345');
  await login.expectError();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});
```

- [ ] **Step 2: Run the spec**

Run: `pnpm --filter @bolao/e2e test resiliencia/falha-de-rede.spec.ts --project=ui-chromium`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/resiliencia/falha-de-rede.spec.ts
git commit -m "test(e2e): network failure shows friendly error"
```

### Task 8.2: API — payload inválido retorna 400 sanitizado

**Files:**
- Create: `e2e/tests/resiliencia/payload-invalido.api.spec.ts`

- [ ] **Step 1: Add `resiliencia` to the api project glob**

Edit `e2e/playwright.config.ts` `api` `testMatch`:
```ts
{ name: 'api', testMatch: /tests\/(authz|aposta|ranking|notificacoes|bolao|resiliencia)\/.*\.api\.spec\.ts/ },
```

- [ ] **Step 2: Write the spec**

```ts
import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado } from '../../api/client';
import { truncateDynamic } from '../../support/db';
import { newUser } from '../../data/factories';

test.describe('Payload inválido (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('registrar com e-mail inválido e senha curta retorna 400', async ({ anonApi }) => {
    const res = await anonApi.post('/auth/registrar', {
      data: { nome: 'x', email: 'nao-eh-email', senha: '123' },
    });
    expect(res.status()).toBe(400);
    const body = await res.text();
    expect(body).not.toContain('at Object'); // sem stack trace vazado
  });

  test('apostar com placar negativo retorna 400', async () => {
    const { ctx } = await criarUsuarioAutenticado(newUser('inval'));
    const res = await ctx.post('/apostas', {
      data: { jogoId: 'qualquer', placarCasa: -1, placarVisitante: 0 },
    });
    expect(res.status()).toBe(400);
    await ctx.dispose();
  });
});
```

- [ ] **Step 3: Run the spec**

Run: `pnpm --filter @bolao/e2e test resiliencia/payload-invalido.api.spec.ts --project=api`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/playwright.config.ts e2e/tests/resiliencia/payload-invalido.api.spec.ts
git commit -m "test(e2e): invalid payload returns sanitized 400 (api)"
```

### Task 8.3: API — sessão expirada e concorrência

**Files:**
- Create: `e2e/tests/resiliencia/sessao-concorrencia.api.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect, request } from '@playwright/test';
import { criarUsuarioAutenticado } from '../../api/client';
import { truncateDynamic, prisma } from '../../support/db';
import { newUser } from '../../data/factories';
import { jogoComApostasAbertas } from '../../support/time';

test.describe('Sessão e concorrência (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('refresh sem cookie válido retorna 401', async () => {
    const anon = await request.newContext({ baseURL: process.env.NEXT_PUBLIC_API_URL });
    const res = await anon.post('/auth/refresh');
    expect(res.status()).toBe(401);
    await anon.dispose();
  });

  test('duplo POST simultâneo de aposta não duplica registro', async () => {
    const { user, ctx } = await criarUsuarioAutenticado(newUser('conc'));
    const jogo = await jogoComApostasAbertas();
    const payload = { data: { jogoId: jogo.id, placarCasa: 1, placarVisitante: 1 } };

    const [r1, r2] = await Promise.all([
      ctx.post('/apostas', payload),
      ctx.post('/apostas', payload),
    ]);
    expect(r1.status()).toBeLessThan(500);
    expect(r2.status()).toBeLessThan(500);

    const count = await prisma.aposta.count({ where: { usuarioId: user.id, jogoId: jogo.id } });
    expect(count).toBe(1);

    await ctx.dispose();
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `pnpm --filter @bolao/e2e test resiliencia/sessao-concorrencia.api.spec.ts --project=api`
Expected: PASS. (The unique `(usuarioId, jogoId)` constraint guarantees a single row; if a race surfaces a 500 instead of upsert, that's a real bug to report, not a test fix.)

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/resiliencia/sessao-concorrencia.api.spec.ts
git commit -m "test(e2e): expired session 401 and concurrent upsert (api)"
```

---

## Phase 9 — CI integration

### Task 9.1: Add e2e job to GitHub Actions

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add the `e2e` job after `test`**

Append this job (sibling of `lint`, `test`, `build-check`). It runs service containers, builds shared, resets the e2e DB, and runs Playwright (which boots backend/frontend via `webServer`).

```yaml
  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [lint, test]
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: bolao
          POSTGRES_PASSWORD: secret
          POSTGRES_DB: bolao_trovao_e2e
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U bolao" --health-interval 10s
          --health-timeout 5s --health-retries 5
      redis:
        image: redis:7
        ports: ['6379:6379']
      mailpit:
        image: axllent/mailpit:latest
        ports: ['8025:8025', '1025:1025']
    env:
      DATABASE_URL: postgresql://bolao:secret@localhost:5432/bolao_trovao_e2e
      REDIS_HOST: localhost
      REDIS_PORT: 6379
      JWT_SECRET: ci-jwt-secret-at-least-32-characters
      JWT_REFRESH_SECRET: ci-jwt-refresh-secret-at-least-32-characters
      JWT_EXPIRES_IN: 15m
      JWT_REFRESH_EXPIRES_IN: 30d
      APP_URL: http://localhost:3000
      PORT: 3001
      NODE_ENV: development
      NEXT_PUBLIC_API_URL: http://localhost:3001
      MAILPIT_URL: http://localhost:8025
      SMTP_HOST: localhost
      SMTP_PORT: 1025
      SMTP_FROM: Bolão Trovão <noreply@bolao.local>
      E2E_BASE_URL: http://localhost:3000
      CI: 'true'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Build shared package
        run: pnpm --filter @bolao/shared build
      - name: Generate Prisma client
        run: pnpm --filter @bolao/backend exec prisma generate
      - name: Install Playwright browser
        run: pnpm --filter @bolao/e2e exec playwright install --with-deps chromium
      - name: Run E2E tests
        run: pnpm --filter @bolao/e2e test
      - name: Upload report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: e2e/playwright-report
          retention-days: 7
```

- [ ] **Step 2: Make the e2e env file CI-aware**

Because `playwright.config.ts` calls `dotenv` on `.env.e2e`, ensure CI env vars win. In `playwright.config.ts`, change the dotenv load to not override existing process env (default behavior of `dotenv` is non-overriding, so this already holds). Verify by reading the config — no code change if dotenv is non-overriding.

- [ ] **Step 3: Validate the workflow YAML locally**

Run: `pnpm dlx @action-validator/cli .github/workflows/ci.yml` (or visually confirm indentation).
Expected: no syntax errors.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add e2e job (playwright + postgres/redis/mailpit services)"
```

- [ ] **Step 5: Push and confirm the job runs green**

```bash
git push
```
Open the PR's Actions run; confirm the `E2E Tests` job passes. If it fails, use the uploaded `playwright-report` artifact (traces) to diagnose.

---

## Phase 10 — Cleanup

### Task 10.1: Remove the smoke test and document running locally

**Files:**
- Delete: `e2e/tests/smoke.spec.ts`
- Modify: `README.md` (Testes section)

- [ ] **Step 1: Delete the smoke test**

```bash
git rm e2e/tests/smoke.spec.ts
```

- [ ] **Step 2: Add an E2E subsection to README "Testes"**

Insert after the existing test commands:
```markdown
### E2E (Playwright)

Pré-requisitos: `pnpm dev:infra` rodando (Postgres, Redis, Mailpit).

```bash
pnpm --filter @bolao/e2e db:reset   # cria/migra/seeda o banco bolao_trovao_e2e
pnpm --filter @bolao/e2e test       # roda toda a suíte (sobe backend+frontend)
pnpm --filter @bolao/e2e test:ui    # modo interativo
```

Os testes usam um banco dedicado (`bolao_trovao_e2e`) e o Mailpit para validar e-mails.
```

- [ ] **Step 3: Commit**

```bash
git add README.md e2e/tests/smoke.spec.ts
git commit -m "test(e2e): drop smoke test, document e2e in README"
```

---

## Self-Review notes (for the implementer)

Most contracts were verified against source while writing this plan: auth endpoints & email templates (subjects + link paths), `enviarParaUsuario` signature, `getRankingDraft` shape, `GET /boloes/:id` membros shape, global auto-join at registration, inactive-login `401`, the deadline `403` message, and the aposta unique constraint.

Two contracts remain inferred and have a confirm step in their task:
- `GET /boloes/:bolaoId/ranking` row shape (Task 5.2) — assert on `usuarioId`; align field names with `ranking.service.obterRanking` if they differ.
- The frontend UI control that triggers push subscription (Task 7.2) — discover the route/button, or drop the UI test if push is only wired in a service worker.

When a real shape differs from the spec's assumption, **align the test to the real contract** — do not change app behavior to satisfy a test. The two places where a failing test means a *real bug* (not a test fix) are called out inline: concurrent upsert (Task 8.3) and the deadline `403` (Task 4.2).
