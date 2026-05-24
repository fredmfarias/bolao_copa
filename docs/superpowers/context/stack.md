# Stack — Bolão Trovão Reescrita

> Contexto permanente. Carregar no início de toda sessão de implementação.

---

## Monorepo

```
bolao-trovao/
├── apps/
│   ├── frontend/          ← Next.js 14
│   └── backend/           ← NestJS 10
├── packages/
│   └── shared/            ← enums e constantes compartilhadas
├── pnpm-workspace.yaml
└── turbo.json
```

Gerenciador de pacotes: **pnpm 9.0.0**  
Orquestrador de build: **Turborepo 2.0**

---

## Frontend

| Lib | Versão |
|---|---|
| Next.js | ^14.2.0 |
| React | ^18.3.0 |
| TypeScript | ^5.4.0 |
| Tailwind CSS | ^3.4.0 |
| `@bolao/shared` | `workspace:*` |

shadcn/ui: **ainda não instalado** — instalar em M1.

### Estrutura de pastas

```
apps/frontend/src/
├── app/
│   ├── (app)/             ← rotas autenticadas (AppLayout com NavBar)
│   ├── (auth)/            ← rotas públicas de auth
│   ├── auth/callback/     ← redirect do Google OAuth
│   ├── layout.tsx         ← RootLayout (envolve AuthProvider)
│   └── page.tsx           ← redirect para /jogos
├── components/            ← componentes compartilhados
├── lib/
│   ├── api.ts             ← cliente HTTP com base URL da env
│   └── auth.ts            ← funções de auth (login, logout, refresh)
└── types/
    └── api.ts             ← tipos de resposta da API
```

### Convenções de import

```typescript
import { Foo } from '@/components/Foo';       // componentes
import { api } from '@/lib/api';              // cliente HTTP
import { BolaoStatus } from '@bolao/shared';  // enums compartilhados
```

Alias `@/` aponta para `apps/frontend/src/`.

### Variáveis de ambiente

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001   # backend URL
```

---

## Backend

| Lib | Versão |
|---|---|
| NestJS | ^10 |
| Prisma | ^5 |
| `@nestjs/jwt` | — |
| `@nestjs/passport` | — |
| passport-google-oauth20 | — |
| bcrypt | — |
| bull (queues) | — |
| web-push (PWA) | — |
| Jest | ^29 |
| ts-jest | — |

### Estrutura de pastas

```
apps/backend/src/
├── aposta/
├── auth/
├── bolao/
├── common/
│   ├── decorators/       ← @CurrentUser()
│   └── guards/           ← JwtAuthGuard, RolesGuard
├── jogo/
├── notificacao/
├── ranking/
└── usuario/
```

### Auth

JWT em `Authorization: Bearer <token>`. Refresh token em cookie `refresh_token` (httpOnly).  
Guard padrão: `@UseGuards(JwtAuthGuard)`.  
Guard de role: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN)`.

---

## Pacote shared

```
packages/shared/src/
└── enums.ts    ← Role, BolaoStatus, BolaoEscopo, JogoFase, BolaoMembroPapel
                   + constantes: BOLAO_GLOBAL_ID, MAX_APOSTAS_*, MINUTOS_PRAZO_APOSTA
```

---

## Comandos

```bash
# Dev (raiz do monorepo)
pnpm dev                          # sobe frontend + backend em paralelo

# Build
pnpm build --filter frontend
pnpm build --filter backend

# Testes (backend, jest)
pnpm test --filter backend
pnpm test --filter backend -- aposta  # filtrar por nome de arquivo

# Lint e type-check
pnpm lint --filter frontend
pnpm build --filter frontend      # também valida tipos via tsc

# Prisma
cd apps/backend && npx prisma migrate dev --name <nome>
cd apps/backend && npx prisma studio
```

---

## Resumo operacional

Monorepo pnpm/Turborepo com dois apps (Next.js 14 + NestJS 10) e um pacote shared de enums. Frontend usa alias `@/` → `src/`. shadcn/ui não está instalado — será adicionado em M1. Backend usa JWT + cookie refresh, guard `JwtAuthGuard` em todos os endpoints protegidos.
