# Segregar Horário do Palpite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um campo `palpiteAtualizadoEm` à tabela `aposta` que registra apenas o horário do salvamento do palpite, sem ser contaminado pelo recálculo de pontuação.

**Architecture:** `atualizadoEm` permanece como `@updatedAt` (genérico). O novo `palpiteAtualizadoEm` é setado explicitamente no `ApostaService.upsert` em todo salvamento, e nunca é tocado pelo `RankingService.recalcularParaJogo`. O frontend passa a exibir `palpiteAtualizadoEm` no lugar de `atualizadoEm`.

**Tech Stack:** NestJS + Prisma (PostgreSQL) no backend; React + Vitest/Testing Library no frontend; monorepo pnpm + turbo.

**Spec:** `docs/superpowers/specs/2026-06-13-segregar-horario-palpite-design.md`

---

## Estrutura de arquivos

- `apps/backend/prisma/schema.prisma` — adiciona o campo `palpiteAtualizadoEm` ao model `Aposta`.
- `apps/backend/prisma/migrations/<timestamp>_segregar_horario_palpite/migration.sql` — gerada pelo Prisma; editada para incluir o backfill.
- `apps/backend/src/aposta/aposta.service.ts` — seta `palpiteAtualizadoEm` no `upsert`; expõe `palpiteAtualizadoEm` em `listarPalpitesPorJogo`.
- `apps/backend/src/aposta/aposta.service.spec.ts` — testes do upsert e do mapper.
- `apps/frontend/src/types/api.ts` — troca `atualizadoEm` por `palpiteAtualizadoEm` nas interfaces `Aposta` e `Palpite`.
- `apps/frontend/src/components/JogoCard.tsx` — usa `aposta.palpiteAtualizadoEm`.
- `apps/frontend/src/components/PalpiteRow.tsx` — usa `p.palpiteAtualizadoEm`.
- Mocks de teste do frontend: `JogoCard.test.tsx`, `jogoEstado.test.ts`, `palpites.test.ts`, `PlacarFiltro.test.tsx`, `PalpiteRow.test.tsx`, `PlacaresDist.test.tsx`.

---

### Task 1: Schema + migração com backfill

**Files:**
- Modify: `apps/backend/prisma/schema.prisma:160-174` (model `Aposta`)
- Create: `apps/backend/prisma/migrations/<timestamp>_segregar_horario_palpite/migration.sql`

- [ ] **Step 1: Adicionar o campo ao model `Aposta`**

Em `apps/backend/prisma/schema.prisma`, no model `Aposta`, adicionar a linha `palpiteAtualizadoEm` logo após `atualizadoEm`:

```prisma
model Aposta {
  id              String   @id @default(uuid())
  usuarioId       String
  usuario         Usuario  @relation(fields: [usuarioId], references: [id])
  jogoId          String
  jogo            Jogo     @relation(fields: [jogoId], references: [id])
  placarCasa      Int
  placarVisitante Int
  pontuacao       Int?
  criadoEm        DateTime @default(now())
  atualizadoEm    DateTime @updatedAt
  palpiteAtualizadoEm DateTime @default(now())

  @@unique([usuarioId, jogoId])
  @@map("aposta")
}
```

- [ ] **Step 2: Gerar a migração sem aplicar (create-only)**

Run: `pnpm --filter @bolao/backend exec dotenv -e ../../.env -- prisma migrate dev --create-only --name segregar_horario_palpite`

Expected: cria a pasta `apps/backend/prisma/migrations/<timestamp>_segregar_horario_palpite/` com um `migration.sql` contendo algo como:

```sql
ALTER TABLE "aposta" ADD COLUMN "palpiteAtualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
```

- [ ] **Step 3: Adicionar o backfill ao `migration.sql`**

Editar o `migration.sql` recém-gerado, adicionando a linha de backfill **após** o `ALTER TABLE`:

```sql
ALTER TABLE "aposta" ADD COLUMN "palpiteAtualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: horário do palpite herda o atualizadoEm atual das apostas existentes.
UPDATE "aposta" SET "palpiteAtualizadoEm" = "atualizadoEm";
```

- [ ] **Step 4: Aplicar a migração e regerar o client**

Run: `pnpm --filter @bolao/backend exec dotenv -e ../../.env -- prisma migrate dev`

Expected: a migração é aplicada sem erros e o Prisma Client é regenerado (sai "Already in sync" / "migration applied"). O tipo `Aposta` do Prisma Client passa a ter `palpiteAtualizadoEm: Date`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations
git commit -m "feat(aposta): adiciona campo palpiteAtualizadoEm com backfill"
```

---

### Task 2: Backend — setar e expor `palpiteAtualizadoEm`

**Files:**
- Modify: `apps/backend/src/aposta/aposta.service.ts:52-56` (upsert) e `:88-96` (mapper de `listarPalpitesPorJogo`)
- Test: `apps/backend/src/aposta/aposta.service.spec.ts`

- [ ] **Step 1: Escrever o teste falho do upsert**

Em `apps/backend/src/aposta/aposta.service.spec.ts`, dentro do `describe('upsert', ...)`, adicionar:

```typescript
it('seta palpiteAtualizadoEm no create e no update do upsert', async () => {
  prismaMock.jogo.findUnique.mockResolvedValue(jogoGrupos);
  prismaMock.aposta.findUnique.mockResolvedValue(null);
  prismaMock.aposta.count.mockResolvedValue(0);
  prismaMock.aposta.upsert.mockResolvedValue({});
  await service.upsert('user-1', { jogoId: 'jogo-1', placarCasa: 1, placarVisitante: 0 });
  const arg = prismaMock.aposta.upsert.mock.calls[0][0];
  expect(arg.create.palpiteAtualizadoEm).toBeInstanceOf(Date);
  expect(arg.update.palpiteAtualizadoEm).toBeInstanceOf(Date);
});
```

- [ ] **Step 2: Escrever o teste falho do mapper de palpites**

Em `apps/backend/src/aposta/aposta.service.spec.ts`, dentro do `describe('listarPalpitesPorJogo', ...)`, adicionar:

```typescript
it('expõe palpiteAtualizadoEm e não expõe atualizadoEm', async () => {
  prismaMock.jogo.findUnique.mockResolvedValue(jogoPassado);
  prismaMock.bolaoMembro.findMany.mockResolvedValue([{ usuarioId: 'user-1' }]);
  const palpitadoEm = new Date('2026-06-11T12:00:00.000Z');
  prismaMock.aposta.findMany.mockResolvedValue([
    { usuarioId: 'user-1', placarCasa: 2, placarVisitante: 1, pontuacao: null,
      palpiteAtualizadoEm: palpitadoEm, atualizadoEm: new Date(),
      usuario: { id: 'user-1', nome: 'Alice', avatarUrl: null } },
  ]);
  const result = await service.listarPalpitesPorJogo('bolao-1', 'jogo-1');
  expect(result[0].palpiteAtualizadoEm).toBe(palpitadoEm);
  expect(result[0]).not.toHaveProperty('atualizadoEm');
});
```

- [ ] **Step 3: Rodar os testes para confirmar que falham**

Run: `pnpm --filter @bolao/backend test -- aposta.service.spec`
Expected: FAIL — `arg.create.palpiteAtualizadoEm` é `undefined`; `result[0].palpiteAtualizadoEm` é `undefined` e `atualizadoEm` ainda presente.

- [ ] **Step 4: Setar `palpiteAtualizadoEm` no upsert**

Em `apps/backend/src/aposta/aposta.service.ts`, substituir o bloco `return this.prisma.aposta.upsert({...})` (linhas ~52-56) por:

```typescript
    const agora = new Date();
    return this.prisma.aposta.upsert({
      where: { usuarioId_jogoId: { usuarioId, jogoId: dto.jogoId } },
      update: {
        placarCasa: dto.placarCasa,
        placarVisitante: dto.placarVisitante,
        pontuacao: null,
        palpiteAtualizadoEm: agora,
      },
      create: {
        usuarioId,
        jogoId: dto.jogoId,
        placarCasa: dto.placarCasa,
        placarVisitante: dto.placarVisitante,
        palpiteAtualizadoEm: agora,
      },
    });
```

- [ ] **Step 5: Expor `palpiteAtualizadoEm` no mapper**

Em `apps/backend/src/aposta/aposta.service.ts`, no `return apostas.map(...)` de `listarPalpitesPorJogo` (linhas ~88-96), trocar a chave `atualizadoEm: a.atualizadoEm` por `palpiteAtualizadoEm: a.palpiteAtualizadoEm`:

```typescript
    return apostas.map(a => ({
      usuarioId: a.usuarioId,
      nome: a.usuario.nome,
      avatarUrl: a.usuario.avatarUrl,
      placarCasa: a.placarCasa,
      placarVisitante: a.placarVisitante,
      pontuacao: a.pontuacao,
      palpiteAtualizadoEm: a.palpiteAtualizadoEm,
    }));
```

- [ ] **Step 6: Rodar os testes para confirmar que passam**

Run: `pnpm --filter @bolao/backend test -- aposta.service.spec`
Expected: PASS — todos os testes do `aposta.service.spec`, incluindo os dois novos.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/aposta/aposta.service.ts apps/backend/src/aposta/aposta.service.spec.ts
git commit -m "feat(aposta): seta e expõe palpiteAtualizadoEm no service"
```

---

### Task 3: Frontend — tipos, componentes e mocks

**Files:**
- Modify: `apps/frontend/src/types/api.ts:53-71` (interfaces `Aposta` e `Palpite`)
- Modify: `apps/frontend/src/components/JogoCard.tsx:100`
- Modify: `apps/frontend/src/components/PalpiteRow.tsx:57`
- Modify (mocks): `apps/frontend/src/__tests__/JogoCard.test.tsx:23`, `jogoEstado.test.ts:16`, `palpites.test.ts:7`, `PlacarFiltro.test.tsx:9`, `PalpiteRow.test.tsx:13`, `PlacaresDist.test.tsx:24`

- [ ] **Step 1: Atualizar as interfaces em `api.ts`**

Em `apps/frontend/src/types/api.ts`, nas interfaces `Aposta` e `Palpite`, trocar `atualizadoEm: string;` por `palpiteAtualizadoEm: string;`:

```typescript
export interface Aposta {
  id: string;
  jogoId: string;
  placarCasa: number;
  placarVisitante: number;
  pontuacao: number | null;
  palpiteAtualizadoEm: string;
  jogo: Jogo;
}

export interface Palpite {
  usuarioId: string;
  nome: string;
  avatarUrl: string | null;
  placarCasa: number;
  placarVisitante: number;
  pontuacao: number | null;
  palpiteAtualizadoEm: string;
}
```

- [ ] **Step 2: Atualizar `JogoCard.tsx`**

Em `apps/frontend/src/components/JogoCard.tsx:100`, trocar `aposta.atualizadoEm` por `aposta.palpiteAtualizadoEm`:

```tsx
            <span className="text-trovao-muted text-[10px]">{formatDataAposta(aposta.palpiteAtualizadoEm)}</span>
```

- [ ] **Step 3: Atualizar `PalpiteRow.tsx`**

Em `apps/frontend/src/components/PalpiteRow.tsx:57`, trocar `p.atualizadoEm` por `p.palpiteAtualizadoEm`:

```tsx
            {formatarAtualizadoEm(p.palpiteAtualizadoEm)}
```

- [ ] **Step 4: Atualizar os mocks de teste**

Em cada arquivo abaixo, renomear a propriedade `atualizadoEm` para `palpiteAtualizadoEm` (mesmo valor) nos objetos mock de `Aposta`/`Palpite`:

- `apps/frontend/src/__tests__/JogoCard.test.tsx:23` — `atualizadoEm: ATUALIZADO,` → `palpiteAtualizadoEm: ATUALIZADO,`
- `apps/frontend/src/__tests__/jogoEstado.test.ts:16` — `atualizadoEm: new Date().toISOString(),` → `palpiteAtualizadoEm: new Date().toISOString(),`
- `apps/frontend/src/__tests__/palpites.test.ts:7` — `atualizadoEm: '2026-06-11T12:00:00.000Z',` → `palpiteAtualizadoEm: '2026-06-11T12:00:00.000Z',`
- `apps/frontend/src/__tests__/PlacarFiltro.test.tsx:9` — `atualizadoEm: '2026-06-11T12:00:00.000Z',` → `palpiteAtualizadoEm: '2026-06-11T12:00:00.000Z',`
- `apps/frontend/src/__tests__/PalpiteRow.test.tsx:13` — `atualizadoEm: '2026-06-11T12:00:00.000Z',` → `palpiteAtualizadoEm: '2026-06-11T12:00:00.000Z',`
- `apps/frontend/src/__tests__/PlacaresDist.test.tsx:24` — `atualizadoEm: new Date().toISOString(),` → `palpiteAtualizadoEm: new Date().toISOString(),`

- [ ] **Step 5: Rodar a typecheck e os testes do frontend**

Run: `pnpm --filter @bolao/frontend test`
Expected: PASS — nenhum erro de tipo sobre `atualizadoEm` ausente; todos os testes passam.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/types/api.ts apps/frontend/src/components/JogoCard.tsx apps/frontend/src/components/PalpiteRow.tsx apps/frontend/src/__tests__
git commit -m "feat(frontend): exibe palpiteAtualizadoEm no lugar de atualizadoEm"
```

---

### Task 4: Verificação final

- [ ] **Step 1: Rodar a suíte completa**

Run: `pnpm test`
Expected: PASS — backend e frontend verdes.

- [ ] **Step 2: Verificar que o recálculo de pontuação não toca o novo campo**

Inspecionar `apps/backend/src/ranking/ranking.service.ts:46` e confirmar que o `aposta.update` continua com `data: { pontuacao }` apenas — sem `palpiteAtualizadoEm`. Nenhuma alteração necessária; apenas confirmação visual.

- [ ] **Step 3: Atualizar o README se aplicável**

Verificar se o README documenta a semântica de campos da aposta ou o "horário do palpite". Se sim, ajustar para mencionar `palpiteAtualizadoEm` vs `atualizadoEm`. (Preferência do usuário: README sempre atualizado em mudanças de regras de negócio.)
