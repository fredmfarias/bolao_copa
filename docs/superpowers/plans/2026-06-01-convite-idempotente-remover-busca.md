# Convite idempotente + remover busca da tela /boloes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir entrar por convite mesmo quando o usuário já é membro do bolão (ex.: bolão global), tornando a entrada idempotente, e remover o formulário de busca de bolão da tela `/boloes`.

**Architecture:** Backend NestJS + Prisma; `BolaoService.entrarViaConvite` ganha um curto-circuito idempotente que retorna a associação existente quando o usuário já é membro, antes de delegar a `adicionarMembro` (que continua estrito). Frontend Next.js (App Router); a página `(app)/boloes/page.tsx` perde o bloco de busca, mantendo só "Meus Bolões". O endpoint backend `GET /boloes/buscar` permanece intocado porque é usado por diálogos de admin.

**Tech Stack:** TypeScript, NestJS, Prisma, Jest (backend), Next.js + React Testing Library + Jest (frontend), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-06-01-convite-idempotente-remover-busca-design.md`

---

## File Structure

- `apps/backend/src/bolao/bolao.service.ts` — Modify `entrarViaConvite` (idempotência).
- `apps/backend/src/bolao/bolao.service.spec.ts` — Add teste de idempotência.
- `apps/frontend/src/app/(app)/boloes/page.tsx` — Remove bloco de busca.
- `apps/frontend/src/__tests__/BolaoesPage.test.tsx` — Add asserção de que a busca não existe mais.

Sem mudanças em `adicionarMembro`, `aprovarMembro`, `solicitarEntrada`, no controller, ou no endpoint `/boloes/buscar`.

---

## Task 1: Entrada via convite idempotente (backend)

**Files:**
- Modify: `apps/backend/src/bolao/bolao.service.ts:68-76` (`entrarViaConvite`)
- Test: `apps/backend/src/bolao/bolao.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Adicione este teste em `apps/backend/src/bolao/bolao.service.spec.ts`, logo após o teste `'entrarViaConvite passa quando admin'` (depois da linha 110, antes do bloco `aprovarMembro`):

```typescript
  it('entrarViaConvite retorna associação existente quando já é membro (idempotente)', async () => {
    const membroExistente = { bolaoId: 'b1', usuarioId: 'user-1' };
    prismaMock.bolaoConvite.findUnique.mockResolvedValue({ bolaoId: 'b1', expiraEm: null });
    prismaMock.bolaoMembro.findUnique.mockResolvedValue(membroExistente);

    const resultado = await service.entrarViaConvite({ id: 'user-1', role: 'USER' }, 'token-valido');

    expect(resultado).toBe(membroExistente);
    expect(prismaMock.bolaoMembro.create).not.toHaveBeenCalled();
    expect(prismaMock.ranking.create).not.toHaveBeenCalled();
    expect(prismaMock.bolaoMembro.count).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bolao/backend test -- bolao.service.spec.ts -t "idempotente"`
Expected: FAIL — hoje `entrarViaConvite` chama `adicionarMembro`, que ao encontrar o membro existente lança `ConflictException('Você já é membro deste bolão.')`, então o `await` rejeita em vez de retornar `membroExistente`.

- [ ] **Step 3: Write minimal implementation**

Em `apps/backend/src/bolao/bolao.service.ts`, substitua o método `entrarViaConvite` (linhas 68-76) por:

```typescript
  async entrarViaConvite(user: { id: string; role: string }, token: string) {
    await this.inscricaoWindow.assertAberta(user);
    const convite = await this.prisma.bolaoConvite.findUnique({ where: { token } });
    if (!convite) throw new BadRequestException('Convite inválido.');
    if (convite.expiraEm && convite.expiraEm < new Date()) {
      throw new BadRequestException('Convite expirado.');
    }
    const jaEMembro = await this.prisma.bolaoMembro.findUnique({
      where: { bolaoId_usuarioId: { bolaoId: convite.bolaoId, usuarioId: user.id } },
    });
    if (jaEMembro) return jaEMembro;
    return this.adicionarMembro(convite.bolaoId, user.id);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bolao/backend test -- bolao.service.spec.ts`
Expected: PASS — todos os testes de `BolaoService`, incluindo o novo de idempotência e os existentes de `entrarViaConvite` (convite expirado, janela fechada, passa quando admin).

Nota: no teste `'entrarViaConvite passa quando admin'`, `prismaMock.bolaoMembro.findUnique` não está mockado e retorna `undefined` por padrão (falsy), então o fluxo segue para `adicionarMembro` como antes — esse teste continua passando sem alteração.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/bolao/bolao.service.ts apps/backend/src/bolao/bolao.service.spec.ts
git commit -m "fix: entrada via convite idempotente quando usuário já é membro

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Remover busca de bolão da tela /boloes (frontend)

**Files:**
- Modify: `apps/frontend/src/app/(app)/boloes/page.tsx`
- Test: `apps/frontend/src/__tests__/BolaoesPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Adicione este teste ao final de `apps/frontend/src/__tests__/BolaoesPage.test.tsx` (após a linha 54):

```typescript
it('não exibe a busca de bolão', async () => {
  mockApiGet.mockResolvedValue([
    { id: GLOBAL_ID, nome: 'Global', status: 'ATIVO', precoReais: '0', _count: { membros: 1 }, maxParticipantes: 100 },
  ]);
  render(<BolaoesPage />);
  await waitFor(() => screen.getByText('Global'));
  expect(screen.queryByText(/buscar bolão/i)).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText(/nome do bolão/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bolao/frontend test -- BolaoesPage.test.tsx -t "não exibe a busca"`
Expected: FAIL — a página ainda renderiza o `<h2>Buscar bolão</h2>` e o input `placeholder="Nome do bolão"`, então `queryByText`/`queryByPlaceholderText` encontram os elementos e o `not.toBeInTheDocument()` falha.

- [ ] **Step 3: Write minimal implementation**

Substitua todo o conteúdo de `apps/frontend/src/app/(app)/boloes/page.tsx` por:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { BolaoCard } from '@/components/BolaoCard';
import { BOLAO_GLOBAL_ID } from '@bolao/shared';
import type { Bolao } from '@/types/api';

export default function BolaoesPage() {
  const { user, refresh } = useAuth();
  const [meus, setMeus] = useState<Bolao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Bolao[]>('/boloes/meus')
      .then(setMeus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const semBolaoReal = !loading && meus.length === 1 && meus[0].id === BOLAO_GLOBAL_ID;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Meus Bolões</h1>
      </div>

      {semBolaoReal && (
        <div className="bg-yellow-900/40 border border-yellow-600/50 text-yellow-200 rounded-lg px-4 py-3 text-sm">
          ⚠ Você ainda não participa de nenhum bolão privado. Entre em contato com o moderador do seu bolão para solicitar um convite.
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-center">Carregando...</p>
      ) : meus.length === 0 ? (
        <p className="text-gray-500 text-center">Você ainda não participa de nenhum bolão privado.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {meus.map(b => (
            <BolaoCard
              key={b.id}
              bolao={b}
              href={`/boloes/${b.id}`}
              favoritoId={user?.bolaoFavoritoId}
              onFavoritoChange={b.id !== BOLAO_GLOBAL_ID ? refresh : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

Mudanças em relação ao original: removidos os estados `busca` e `resultados`, a função `handleBusca`, o `<h2>Buscar bolão</h2>`, o `<form>` de busca e a grade de resultados. Os imports `useState`/`useEffect` continuam necessários (`meus`, `loading`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bolao/frontend test -- BolaoesPage.test.tsx`
Expected: PASS — os quatro testes do arquivo passam (banner com só global, sem banner com bolão real, sem banner durante carregamento, e o novo "não exibe a busca").

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/app/(app)/boloes/page.tsx apps/frontend/src/__tests__/BolaoesPage.test.tsx
git commit -m "feat: remover busca de bolão da tela /boloes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Verificação final

**Files:** nenhuma alteração — apenas validação.

- [ ] **Step 1: Rodar a suíte completa**

Run: `pnpm test`
Expected: PASS — turbo roda os testes de backend e frontend; todos verdes.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: PASS — sem erros de lint. Em particular, confirme que `apps/frontend/src/app/(app)/boloes/page.tsx` não tem imports não usados (ex.: `useState` permanece usado por `meus`/`loading`).

- [ ] **Step 3: Sanity manual (opcional, se houver dev server)**

Suba o app (`pnpm dev`), faça login com um usuário já registrado (membro do bolão global) e abra um link de convite para o bolão global: deve entrar/redirecionar sem erro "já é membro". Abra `/boloes`: não deve haver formulário de busca, apenas "Meus Bolões".

---

## Self-Review Notes

- **Cobertura do spec:** Problema 1 (idempotência) → Task 1; Problema 2 (remover busca) → Task 2; testes do spec (backend idempotência + ajuste frontend) → Tasks 1 e 2; verificação → Task 3.
- **Backend `/boloes/buscar` preservado:** Task 2 só toca o frontend `page.tsx`; `buscarPorNome`/controller/endpoint permanecem, mantendo `AdminCriarUsuarioDialog` e `AdminAdicionarBolaoDialog` funcionando.
- **Consistência de tipos:** `entrarViaConvite` retorna `BolaoMembro` (associação) tanto no caminho idempotente quanto via `adicionarMembro` — coerente com o uso atual no controller e no `auth.service`.
