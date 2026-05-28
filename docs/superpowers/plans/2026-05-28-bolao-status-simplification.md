# Bolão Status Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-value `BolaoStatus` enum (`ATIVO`, `PAGO`, `ARQUIVADO`) with a 2-value enum (`ATIVO`, `INATIVO`), where bolões nascem `ATIVO`, apenas `ATIVO` são rankeados e buscáveis.

**Architecture:** A mudança começa no pacote compartilhado (`@bolao/shared`) que é a fonte de verdade do enum, propaga ao schema Prisma via migration, ajusta os serviços backend que filtravam por `PAGO`, e por fim alinha o frontend (types + UI do painel admin).

**Tech Stack:** NestJS, Prisma (PostgreSQL), Next.js 14, TypeScript, Jest, pnpm monorepo.

---

## File Map

| Arquivo | O que muda |
|---|---|
| `packages/shared/src/enums.ts` | Remove `PAGO`/`ARQUIVADO`; adiciona `INATIVO` |
| `apps/backend/prisma/schema.prisma` | Enum atualizado |
| `apps/backend/prisma/seed.ts` | `BolaoStatus.PAGO` → `BolaoStatus.ATIVO` |
| `apps/backend/src/publicacao/publicacao.service.ts` | Filtro `'PAGO'` → `'ATIVO'` |
| `apps/backend/src/publicacao/publicacao.service.spec.ts` | Atualiza assertion e descrição do teste |
| `apps/frontend/src/types/api.ts` | Union types trocam `PAGO`/`ARQUIVADO` por `INATIVO` |
| `apps/frontend/src/app/admin/boloes/page.tsx` | Toggle `ATIVO`↔`INATIVO`, labels corrigidos |

---

## Task 1: Atualizar o enum compartilhado

**Files:**
- Modify: `packages/shared/src/enums.ts`

- [ ] **Step 1: Atualizar o enum**

Substituir o conteúdo do enum `BolaoStatus` em `packages/shared/src/enums.ts`:

```ts
export enum BolaoStatus {
  ATIVO = 'ATIVO',
  INATIVO = 'INATIVO',
}
```

O restante do arquivo (`BolaoEscopo`, `JogoFase`, `BolaoMembroPapel`, constantes) permanece igual.

- [ ] **Step 2: Verificar que o TypeScript do pacote compila**

```bash
cd packages/shared && pnpm tsc --noEmit
```

Esperado: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/enums.ts
git commit -m "feat(shared): simplify BolaoStatus to ATIVO/INATIVO"
```

---

## Task 2: Atualizar Prisma schema, gerar migration e corrigir seed

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Modify: `apps/backend/prisma/seed.ts`

- [ ] **Step 1: Atualizar o enum no schema**

Em `apps/backend/prisma/schema.prisma`, substituir:

```prisma
enum BolaoStatus {
  ATIVO
  PAGO
  ARQUIVADO
}
```

Por:

```prisma
enum BolaoStatus {
  ATIVO
  INATIVO
}
```

O `model Bolao` já tem `status BolaoStatus @default(ATIVO)` — não muda.

- [ ] **Step 2: Corrigir o seed antes de rodar a migration**

Em `apps/backend/prisma/seed.ts`, linha ~31, trocar `BolaoStatus.PAGO` por `BolaoStatus.ATIVO`:

```ts
await prisma.bolao.upsert({
  where: { id: BOLAO_GLOBAL_ID },
  update: {},
  create: {
    id: BOLAO_GLOBAL_ID,
    nome: 'Bolão Global — Copa 2026',
    descricao: 'Bolão público. Todos os participantes entram automaticamente.',
    status: BolaoStatus.ATIVO,   // era PAGO
    escopo: BolaoEscopo.AMBOS,
    maxParticipantes: 99999,
    precoReais: 0,
    criadoPorId: ADMIN_ID,
  },
});
```

- [ ] **Step 3: Gerar a migration e resetar o banco**

O flag `--force-reset` recria o banco do zero, aplica todas as migrations (incluindo a nova) e roda o seed automaticamente — seguro porque o banco pode ser resetado.

```bash
cd apps/backend && pnpm prisma migrate dev --name simplify-bolao-status --force-reset
```

Esperado: migration criada em `prisma/migrations/..._simplify-bolao-status/migration.sql`, banco recriado, output `Seed concluído: 16 estádios, 48 seleções, 72 jogos.`

> **Nota:** `apps/backend/src/bolao/dto/update-bolao-status.dto.ts` usa `@IsEnum(BolaoStatus)` importado do shared — atualiza automaticamente e passa a aceitar apenas `ATIVO`/`INATIVO` sem mudança de código.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/seed.ts apps/backend/prisma/migrations/
git commit -m "feat(backend): update BolaoStatus enum to ATIVO/INATIVO and regenerate migration"
```

---

## Task 3: Atualizar publicacao.service e seu spec

**Files:**
- Modify: `apps/backend/src/publicacao/publicacao.service.ts`
- Modify: `apps/backend/src/publicacao/publicacao.service.spec.ts`

- [ ] **Step 1: Atualizar o filtro no service**

Em `apps/backend/src/publicacao/publicacao.service.ts`, linha ~47, trocar `status: 'PAGO'` por `status: 'ATIVO'`:

```ts
const boloes = await this.prisma.bolao.findMany({
  where: { status: 'ATIVO' },
  select: { id: true },
});
```

- [ ] **Step 2: Rodar o spec antes de atualizar** (deve falhar)

```bash
cd apps/backend && pnpm jest publicacao.service.spec --no-coverage
```

Esperado: o teste `só recalcula bolões habilitados (status PAGO)` deve falhar pois o service agora filtra `ATIVO`.

- [ ] **Step 3: Atualizar o spec**

Em `apps/backend/src/publicacao/publicacao.service.spec.ts`, linha ~100-108, substituir:

```ts
it('só recalcula bolões ativos', async () => {
  setupBase();
  prismaMock.rankingSnapshot.findMany.mockResolvedValue([]);
  await service.publicar('admin-1');
  expect(prismaMock.bolao.findMany).toHaveBeenCalledWith({
    where: { status: 'ATIVO' }, select: { id: true },
  });
  expect(rankingMock.recalcularRankingBolao).toHaveBeenCalledWith('b1');
});
```

- [ ] **Step 4: Rodar os specs do publicacao**

```bash
cd apps/backend && pnpm jest publicacao.service.spec --no-coverage
```

Esperado: todos os testes passam (5 testes).

- [ ] **Step 5: Rodar todos os specs do backend**

```bash
cd apps/backend && pnpm jest --no-coverage
```

Esperado: todos passam sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/publicacao/publicacao.service.ts apps/backend/src/publicacao/publicacao.service.spec.ts
git commit -m "feat(backend): rank only ATIVO boloes on publication"
```

---

## Task 4: Atualizar frontend — types e painel admin

**Files:**
- Modify: `apps/frontend/src/types/api.ts`
- Modify: `apps/frontend/src/app/admin/boloes/page.tsx`

- [ ] **Step 1: Atualizar os types**

Em `apps/frontend/src/types/api.ts`, substituir as duas ocorrências de `'ATIVO' | 'PAGO' | 'ARQUIVADO'`:

Interface `Bolao` (linha ~16):
```ts
status: 'ATIVO' | 'INATIVO';
```

Interface `AdminBolao` (linha ~92):
```ts
status: 'ATIVO' | 'INATIVO';
```

- [ ] **Step 2: Atualizar a função `alternar` e os labels no painel admin**

Em `apps/frontend/src/app/admin/boloes/page.tsx`, substituir a função `alternar` (linha ~51-54):

```ts
async function alternar(b: AdminBolao) {
  const novo = b.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
  await api.patch(`/boloes/${b.id}/status`, { status: novo }).catch(() => {});
  carregar();
}
```

E o botão de status (linha ~124-129), substituir:

```tsx
<button onClick={() => alternar(b)}
  className={`px-3 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${
    b.status === 'ATIVO'
      ? 'bg-trovao-green/10 text-trovao-green border-trovao-green/40'
      : 'bg-trovao-surface text-trovao-muted border-trovao-border hover:border-trovao-gold'}`}>
  {b.status === 'ATIVO' ? 'Ativo' : 'Inativo'}
</button>
```

- [ ] **Step 3: Verificar typecheck do frontend**

```bash
cd apps/frontend && pnpm tsc --noEmit
```

Esperado: nenhum erro.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/types/api.ts apps/frontend/src/app/admin/boloes/page.tsx
git commit -m "feat(frontend): update bolao status types and admin toggle to ATIVO/INATIVO"
```

---

## Verificação Final

- [ ] **Rodar todos os testes do backend**

```bash
cd apps/backend && pnpm jest --no-coverage
```

Esperado: todos os suites passam.

- [ ] **Rodar typecheck completo do monorepo**

```bash
cd apps/backend && pnpm tsc --noEmit
cd apps/frontend && pnpm tsc --noEmit
```

Esperado: sem erros em ambos.
