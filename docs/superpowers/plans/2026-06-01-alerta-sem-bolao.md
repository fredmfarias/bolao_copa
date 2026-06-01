# Alerta de Usuário Sem Bolão Privado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir um banner informativo na página "Meus Bolões" quando o usuário só tem o bolão global, orientando-o a contatar o moderador para obter um convite.

**Architecture:** A única mudança está em `BolaoesPage`: após o fetch de `/boloes/meus`, deriva-se um booleano `semBolaoReal` que é `true` quando o array contém exatamente o bolão global. O banner é renderizado condicionalmente entre o título e a grade de cards — sem chamadas extras ao backend.

**Tech Stack:** Next.js 14 (App Router), React, Tailwind CSS, Jest + React Testing Library

---

### Task 1: Escrever testes para BolaoesPage

**Files:**
- Create: `apps/frontend/src/__tests__/BolaoesPage.test.tsx`

- [ ] **Step 1: Criar o arquivo de teste com os 3 casos**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import BolaoesPage from '@/app/(app)/boloes/page';

const GLOBAL_ID = '00000000-0000-0000-0000-000000000001';

const mockApiGet = jest.fn();

jest.mock('@/lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args) },
}));

jest.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { bolaoFavoritoId: null }, refresh: jest.fn() }),
}));

jest.mock('@/components/BolaoCard', () => ({
  BolaoCard: ({ bolao }: { bolao: { nome: string } }) => <div>{bolao.nome}</div>,
}));

beforeEach(() => {
  mockApiGet.mockResolvedValue([]);
});

it('exibe banner quando usuário tem apenas o bolão global', async () => {
  mockApiGet.mockResolvedValue([
    { id: GLOBAL_ID, nome: 'Global', status: 'ATIVO', precoReais: '0', _count: { membros: 1 }, maxParticipantes: 100 },
  ]);
  render(<BolaoesPage />);
  await waitFor(() =>
    expect(
      screen.getByText(/você ainda não participa de nenhum bolão privado/i),
    ).toBeInTheDocument(),
  );
});

it('não exibe banner quando usuário tem bolões reais além do global', async () => {
  mockApiGet.mockResolvedValue([
    { id: GLOBAL_ID, nome: 'Global', status: 'ATIVO', precoReais: '0', _count: { membros: 1 }, maxParticipantes: 100 },
    { id: 'bolao-2', nome: 'Bolão Real', status: 'ATIVO', precoReais: '10', _count: { membros: 5 }, maxParticipantes: 20 },
  ]);
  render(<BolaoesPage />);
  await waitFor(() => screen.getByText('Bolão Real'));
  expect(
    screen.queryByText(/você ainda não participa de nenhum bolão privado/i),
  ).not.toBeInTheDocument();
});

it('não exibe banner durante carregamento', () => {
  mockApiGet.mockReturnValue(new Promise(() => {})); // never resolves
  render(<BolaoesPage />);
  expect(
    screen.queryByText(/você ainda não participa de nenhum bolão privado/i),
  ).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar o teste para verificar que falha**

```
cd apps/frontend && npx jest BolaoesPage --no-coverage
```

Expected: FAIL — `screen.getByText(/você ainda não participa de nenhum bolão privado/i)` not found (banner ainda não existe).

- [ ] **Step 3: Commit do teste falhando**

```bash
git add apps/frontend/src/__tests__/BolaoesPage.test.tsx
git commit -m "test: casos failing para banner de sem-bolão em BolaoesPage"
```

---

### Task 2: Implementar o banner em BolaoesPage

**Files:**
- Modify: `apps/frontend/src/app/(app)/boloes/page.tsx`

- [ ] **Step 1: Adicionar `semBolaoReal` e o banner JSX**

Substituir o conteúdo completo de `apps/frontend/src/app/(app)/boloes/page.tsx` por:

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
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Bolao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Bolao[]>('/boloes/meus')
      .then(setMeus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const semBolaoReal = !loading && meus.length === 1 && meus[0].id === BOLAO_GLOBAL_ID;

  async function handleBusca(e: React.FormEvent) {
    e.preventDefault();
    if (!busca.trim()) return;
    const data = await api.get<Bolao[]>(`/boloes/buscar?nome=${encodeURIComponent(busca)}`).catch(() => []);
    setResultados(data);
  }

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

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Buscar bolão</h2>
        <form onSubmit={handleBusca} className="flex gap-2">
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Nome do bolão"
            className="flex-1 min-w-0 bg-trovao-card border border-trovao-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-trovao-gold"
          />
          <button
            type="submit"
            className="bg-trovao-surface hover:bg-trovao-border px-4 py-2 rounded-lg text-sm text-white"
          >
            Buscar
          </button>
        </form>
        {resultados.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {resultados.map(b => (
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
    </div>
  );
}
```

- [ ] **Step 2: Rodar os testes de BolaoesPage para verificar que passam**

```
cd apps/frontend && npx jest BolaoesPage --no-coverage
```

Expected: PASS — 3 tests passing.

- [ ] **Step 3: Rodar a suite completa para verificar sem regressões**

```
cd apps/frontend && npx jest --no-coverage
```

Expected: All tests passing (incluindo os 3 novos).

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/app/(app)/boloes/page.tsx
git commit -m "feat: banner de alerta para usuário sem bolão privado"
```
