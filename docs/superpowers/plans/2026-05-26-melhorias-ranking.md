# Melhorias na Tela de Ranking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o pódio (1º lugar no centro), incluir os 3 primeiros na lista expandível e mover o gráfico de evolução para dentro de cada linha.

**Architecture:** Três mudanças localizadas em arquivos de frontend. `RankingPodium` usa slots explícitos em vez de índices indiretos. `RankingRow` recebe `bolaoId`, busca evolução lazily ao expandir e exibe `RankingEvolucao` dentro da expansão. `page.tsx` remove o estado/bloco fixo de evolução e o `slice(3)`.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Recharts, Jest + Testing Library

---

## Mapa de arquivos

| Arquivo | Operação |
|---|---|
| `apps/frontend/src/components/RankingPodium.tsx` | Modificar |
| `apps/frontend/src/__tests__/RankingPodium.test.tsx` | Modificar |
| `apps/frontend/src/components/RankingRow.tsx` | Modificar |
| `apps/frontend/src/__tests__/RankingRow.test.tsx` | Modificar |
| `apps/frontend/src/app/(app)/ranking/[bolaoId]/page.tsx` | Modificar |

---

## Task 1: Corrigir RankingPodium

**Files:**
- Modify: `apps/frontend/src/components/RankingPodium.tsx`
- Modify: `apps/frontend/src/__tests__/RankingPodium.test.tsx`

- [ ] **Step 1: Adicionar teste para verificar que `scale-110` é aplicado somente no 1º lugar**

Abrir `apps/frontend/src/__tests__/RankingPodium.test.tsx` e adicionar o seguinte teste ao final do arquivo:

```tsx
it('aplica scale-110 apenas no 1º lugar', () => {
  const { container } = render(<RankingPodium ranking={ranking} />);
  const scaled = container.querySelectorAll('[class*="scale-110"]');
  expect(scaled).toHaveLength(1);
  expect(scaled[0]).toHaveTextContent('Alice');
});
```

- [ ] **Step 2: Rodar o novo teste para verificar que falha**

```bash
cd apps/frontend && npx jest --testPathPattern=RankingPodium --no-coverage
```

Resultado esperado: o novo teste falha (ou passa, mas agora há uma asserção explícita da posição central).

- [ ] **Step 3: Substituir o componente `RankingPodium`**

Reescrever `apps/frontend/src/components/RankingPodium.tsx` com o conteúdo abaixo. O `ORDER` indireto é removido; os slots são declarados explicitamente na ordem visual (esquerda → centro → direita):

```tsx
import type { RankingEntry } from '@/types/api';

interface RankingPodiumProps {
  ranking: RankingEntry[];
  myId?: string;
}

export function RankingPodium({ ranking, myId }: RankingPodiumProps) {
  const top3 = ranking.slice(0, 3);
  if (top3.length === 0) return null;

  const slots = [
    { entry: top3[1], medal: '🥈', height: 'h-16', isCenter: false },
    { entry: top3[0], medal: '🥇', height: 'h-24', isCenter: true  },
    { entry: top3[2], medal: '🥉', height: 'h-12', isCenter: false },
  ];

  return (
    <div className="flex items-end justify-center gap-3 py-4">
      {slots.map(({ entry, medal, height, isCenter }, i) => {
        if (!entry) return <div key={i} className="w-24" />;
        const isMe = entry.usuarioId === myId;

        return (
          <div key={entry.id} data-my={isMe || undefined}
            className={`flex flex-col items-center gap-1 ${isCenter ? 'scale-110' : ''}`}>
            <span className="text-2xl">{medal}</span>
            {entry.usuario.avatarUrl ? (
              <img src={entry.usuario.avatarUrl} alt={entry.usuario.nome}
                className="w-10 h-10 rounded-full border-2 border-trovao-border" />
            ) : (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                ${isMe ? 'bg-trovao-gold text-trovao-base' : 'bg-trovao-surface text-trovao-muted'}`}>
                {entry.usuario.nome.charAt(0).toUpperCase()}
              </div>
            )}
            <p className={`text-xs font-semibold text-center max-w-[72px] truncate
              ${isMe ? 'text-trovao-gold' : 'text-white'}`}>
              {entry.usuario.nome}
            </p>
            <div className={`${height} w-20 rounded-t-lg flex flex-col items-center justify-end pb-1
              bg-trovao-surface border border-trovao-border`}>
              <span className={`text-sm font-bold tabular-nums ${isMe ? 'text-trovao-gold' : 'text-white'}`}>
                {entry.pontuacaoTotal}
              </span>
              <span className="text-trovao-muted text-[10px]">pts</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Rodar todos os testes do pódio**

```bash
cd apps/frontend && npx jest --testPathPattern=RankingPodium --no-coverage
```

Resultado esperado: todos os 5 testes passam (4 existentes + 1 novo).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/RankingPodium.tsx apps/frontend/src/__tests__/RankingPodium.test.tsx
git commit -m "fix: corrige ordem do pódio — 1º lugar no centro"
```

---

## Task 2: Atualizar RankingRow com grid completo e evolução lazy

**Files:**
- Modify: `apps/frontend/src/components/RankingRow.tsx`
- Modify: `apps/frontend/src/__tests__/RankingRow.test.tsx`

- [ ] **Step 1: Atualizar os testes de `RankingRow`**

Reescrever `apps/frontend/src/__tests__/RankingRow.test.tsx` com o conteúdo abaixo. Mudanças: `bolaoId` adicionado a todos os renders; `api.get` mockado; novos testes para os 6 itens do grid e para o fluxo de evolução:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RankingRow } from '@/components/RankingRow';
import type { RankingEntry } from '@/types/api';

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));

// Recharts usa ResizeObserver; mock para jsdom.
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  } as any;
});

import { api } from '@/lib/api';
const mockGet = api.get as jest.Mock;

beforeEach(() => {
  mockGet.mockResolvedValue([]);
});

const entry: RankingEntry = {
  id: 'r1', usuarioId: 'u1', posicao: 4, posicoesGanhas: 0,
  pontuacaoTotal: 55, pontuacaoRodada: 0,
  acertosPlacarExato: 3, acertosPlacarVencedor: 5, acertosPlacarPerdedor: 1,
  acertosEmpate: 1, acertosGanhador: 2, acertosNada: 0, apostasPostadas: 11,
  usuario: { id: 'u1', nome: 'Diego', avatarUrl: null },
};

it('exibe posição, nome e pontuação', () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  expect(screen.getByText('4º')).toBeInTheDocument();
  expect(screen.getByText('Diego')).toBeInTheDocument();
  expect(screen.getByText('55')).toBeInTheDocument();
});

it('estatísticas ficam ocultas inicialmente', () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  expect(screen.queryByText('Placar exato')).not.toBeInTheDocument();
});

it('expande para mostrar os 6 itens do grid ao clicar', async () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Placar exato')).toBeInTheDocument();
  expect(screen.getByText('Placar do vencedor correto')).toBeInTheDocument();
  expect(screen.getByText('Empate correto (sem placar exato)')).toBeInTheDocument();
  expect(screen.getByText('Placar do perdedor correto')).toBeInTheDocument();
  expect(screen.getByText('Acertou apenas o vencedor')).toBeInTheDocument();
  expect(screen.getByText('Apostas feitas')).toBeInTheDocument();
});

it('exibe os valores corretos dos acertos no grid', async () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button'));
  // acertosPlacarExato=3, acertosPlacarVencedor=5, acertosPlacarPerdedor=1,
  // acertosEmpate=1, acertosGanhador=2, apostasPostadas=11
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getByText('5')).toBeInTheDocument();
  expect(screen.getByText('1')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
  expect(screen.getByText('11')).toBeInTheDocument();
});

it('destaca o usuário atual com cor ouro', () => {
  render(<RankingRow entry={entry} myId="u1" bolaoId="b1" />);
  expect(screen.getByText('Diego').className).toMatch(/trovao-gold/);
});

it('busca evolução com o usuarioId correto ao expandir', async () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => {
    expect(mockGet).toHaveBeenCalledWith(
      '/boloes/b1/ranking/evolucao?usuarioId=u1',
    );
  });
});

it('não repete a busca de evolução ao reabrir a linha', async () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button')); // abre
  await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button')); // fecha
  fireEvent.click(screen.getByRole('button')); // reabre
  expect(mockGet).toHaveBeenCalledTimes(1);    // não chamou de novo
});

it('exibe o gráfico de evolução quando há dados', async () => {
  mockGet.mockResolvedValueOnce([
    { numero: 1, posicao: 3 },
    { numero: 2, posicao: 2 },
  ]);
  const { container } = render(<RankingRow entry={entry} bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => {
    expect(container.querySelector('.recharts-responsive-container')).toBeTruthy();
  });
});

it('não exibe gráfico quando evolução está vazia', async () => {
  mockGet.mockResolvedValueOnce([]);
  const { container } = render(<RankingRow entry={entry} bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
  expect(container.querySelector('.recharts-responsive-container')).toBeFalsy();
});
```

- [ ] **Step 2: Rodar os testes para verificar que falham**

```bash
cd apps/frontend && npx jest --testPathPattern=RankingRow --no-coverage
```

Resultado esperado: vários testes falham (falta `bolaoId`, itens do grid antigos, sem fetch de evolução).

- [ ] **Step 3: Reescrever o componente `RankingRow`**

Reescrever `apps/frontend/src/components/RankingRow.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { RankingEntry, EvolucaoPonto } from '@/types/api';
import { api } from '@/lib/api';
import { RankingEvolucao } from './RankingEvolucao';

interface RankingRowProps {
  entry: RankingEntry;
  myId?: string;
  bolaoId: string;
}

const ACERTOS = [
  { label: 'Placar exato',                      key: 'acertosPlacarExato'    },
  { label: 'Placar do vencedor correto',         key: 'acertosPlacarVencedor' },
  { label: 'Empate correto (sem placar exato)',  key: 'acertosEmpate'         },
  { label: 'Placar do perdedor correto',         key: 'acertosPlacarPerdedor' },
  { label: 'Acertou apenas o vencedor',          key: 'acertosGanhador'       },
  { label: 'Apostas feitas',                     key: 'apostasPostadas'       },
] as const;

export function RankingRow({ entry, myId, bolaoId }: RankingRowProps) {
  const [expandido, setExpandido] = useState(false);
  const [evolucao, setEvolucao] = useState<EvolucaoPonto[] | null>(null);
  const [loadingEv, setLoadingEv] = useState(false);
  const isMe = entry.usuarioId === myId;

  const handleExpand = () => {
    const abrir = !expandido;
    setExpandido(abrir);
    if (abrir && evolucao === null) {
      setLoadingEv(true);
      api.get<EvolucaoPonto[]>(`/boloes/${bolaoId}/ranking/evolucao?usuarioId=${entry.usuarioId}`)
        .then(setEvolucao)
        .catch(() => setEvolucao([]))
        .finally(() => setLoadingEv(false));
    }
  };

  return (
    <div className={`rounded-xl border transition-colors ${
      isMe ? 'border-trovao-gold/50 bg-trovao-gold/5' : 'border-trovao-border bg-trovao-card'
    }`}>
      <button
        onClick={handleExpand}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-trovao-muted text-sm w-7 flex-shrink-0">{entry.posicao}º</span>

        {entry.usuario.avatarUrl ? (
          <img src={entry.usuario.avatarUrl} alt={entry.usuario.nome}
            className="w-8 h-8 rounded-full flex-shrink-0" />
        ) : (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
            ${isMe ? 'bg-trovao-gold text-trovao-base' : 'bg-trovao-surface text-trovao-muted'}`}>
            {entry.usuario.nome.charAt(0).toUpperCase()}
          </div>
        )}

        <span className={`flex-1 text-sm font-semibold truncate ${isMe ? 'text-trovao-gold' : 'text-white'}`}>
          {entry.usuario.nome}
        </span>

        {entry.posicoesGanhas !== 0 && (
          <span className={`text-xs font-semibold tabular-nums ${
            entry.posicoesGanhas > 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {entry.posicoesGanhas > 0 ? '▲' : '▼'}{Math.abs(entry.posicoesGanhas)}
          </span>
        )}

        <span className={`text-sm font-bold tabular-nums ${isMe ? 'text-trovao-gold' : 'text-white'}`}>
          {entry.pontuacaoTotal}
        </span>

        <span className="text-trovao-muted text-xs ml-1">{expandido ? '▲' : '▼'}</span>
      </button>

      {expandido && (
        <div className="px-4 pb-3 border-t border-trovao-border/50 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {ACERTOS.map(({ label, key }) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="text-trovao-muted">{label}</span>
                <span className="text-white font-semibold tabular-nums">{entry[key]}</span>
              </div>
            ))}
          </div>

          {loadingEv && (
            <p className="text-trovao-muted text-xs text-center py-2">Carregando evolução...</p>
          )}
          {!loadingEv && evolucao && evolucao.length > 0 && (
            <RankingEvolucao dados={evolucao} />
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar os testes de `RankingRow`**

```bash
cd apps/frontend && npx jest --testPathPattern=RankingRow --no-coverage
```

Resultado esperado: todos os testes passam.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/RankingRow.tsx apps/frontend/src/__tests__/RankingRow.test.tsx
git commit -m "feat: RankingRow com grid de 6 acertos e evolução lazy por usuário"
```

---

## Task 3: Atualizar page.tsx

**Files:**
- Modify: `apps/frontend/src/app/(app)/ranking/[bolaoId]/page.tsx`

- [ ] **Step 1: Reescrever `page.tsx`**

Substituir o conteúdo de `apps/frontend/src/app/(app)/ranking/[bolaoId]/page.tsx` pelo seguinte. Mudanças: removidos `evolucao` state, fetch e bloco JSX "Sua evolução"; removido `slice(3)`; `bolaoId` passado para `RankingRow`; `EvolucaoPonto` e `RankingEvolucao` removidos dos imports:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { RankingPodium } from '@/components/RankingPodium';
import { RankingRow } from '@/components/RankingRow';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import type { RankingEntry, PublicacaoResumo } from '@/types/api';

type Aba = 'geral' | 'rodada';

export default function RankingPage() {
  const { bolaoId } = useParams<{ bolaoId: string }>();
  const { user } = useAuth();
  const [aba, setAba] = useState<Aba>('geral');
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [publicacoes, setPublicacoes] = useState<PublicacaoResumo[]>([]);
  const [publicacaoSel, setPublicacaoSel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<RankingEntry[]>(`/boloes/${bolaoId}/ranking`).catch(() => [] as RankingEntry[]),
      api.get<PublicacaoResumo[]>(`/boloes/${bolaoId}/ranking/publicacoes`).catch(() => [] as PublicacaoResumo[]),
    ]).then(([r, pubs]) => {
      setRanking(r);
      setPublicacoes(pubs);
      setPublicacaoSel(pubs[0]?.numero ?? null);
      setLoading(false);
    });
  }, [bolaoId]);

  useEffect(() => {
    if (publicacaoSel === null) return;
    api.get<RankingEntry[]>(`/boloes/${bolaoId}/ranking?publicacao=${publicacaoSel}`)
      .then(setRanking)
      .catch(() => setRanking([]));
  }, [publicacaoSel, bolaoId]);

  const ordenado = aba === 'rodada'
    ? [...ranking].sort((a, b) => b.pontuacaoRodada - a.pontuacaoRodada)
    : ranking;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ranking</h1>
        <Link href={`/boloes/${bolaoId}`} className="text-trovao-muted text-sm hover:text-white">← Voltar</Link>
      </div>

      {loading ? (
        <PageSkeleton />
      ) : ranking.length === 0 && publicacoes.length === 0 ? (
        <EmptyState
          titulo="Aguardando publicação"
          descricao="O ranking será publicado pelo administrador após os jogos."
        />
      ) : (
        <>
          <div className="flex gap-2">
            <button onClick={() => setAba('geral')}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                aba === 'geral' ? 'bg-trovao-gold text-trovao-base border-trovao-gold'
                  : 'bg-trovao-surface text-trovao-muted border-trovao-border'}`}>
              Geral
            </button>
            <button onClick={() => setAba('rodada')}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                aba === 'rodada' ? 'bg-trovao-gold text-trovao-base border-trovao-gold'
                  : 'bg-trovao-surface text-trovao-muted border-trovao-border'}`}>
              Rodada
            </button>
          </div>

          {aba === 'rodada' && publicacoes.length > 0 && (
            <select
              value={publicacaoSel ?? ''}
              onChange={(e) => setPublicacaoSel(Number(e.target.value))}
              className="bg-trovao-surface border border-trovao-border rounded-lg text-sm px-2 py-1 text-white"
            >
              {publicacoes.map((p) => (
                <option key={p.numero} value={p.numero}>Rodada {p.numero}</option>
              ))}
            </select>
          )}

          {aba === 'geral' && (
            <RankingPodium ranking={ordenado} myId={user?.id} />
          )}

          <div className="space-y-2 mt-4">
            {ordenado.map((entry) => (
              <RankingRow
                key={entry.id}
                entry={aba === 'rodada'
                  ? { ...entry, pontuacaoTotal: entry.pontuacaoRodada, posicoesGanhas: 0 }
                  : entry}
                myId={user?.id}
                bolaoId={bolaoId}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rodar todos os testes do frontend para detectar regressões**

```bash
cd apps/frontend && npx jest --no-coverage
```

Resultado esperado: todos os testes passam. Nenhum import quebrado, nenhuma prop faltando.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/app/\(app\)/ranking/\[bolaoId\]/page.tsx
git commit -m "feat: ranking mostra top 3 na lista e remove bloco fixo de evolução"
```

---

## Self-Review

**Spec coverage:**
- ✅ Pódio corrigido com slots explícitos (Task 1)
- ✅ Top 3 incluídos na lista — `slice(3)` removido (Task 3)
- ✅ Gráfico de evolução na expansão, lazy, por usuário (Task 2)
- ✅ Grid com 6 itens (Placar exato, vencedor, empate, perdedor, ganhador, apostas) (Task 2)
- ✅ Gráfico só exibido quando há dados (Task 2, step 3 — condição `evolucao.length > 0`)
- ✅ Bloco "Sua evolução" removido de `page.tsx` (Task 3)

**Placeholder scan:** Nenhum TBD, TODO ou step sem código.

**Type consistency:** `EvolucaoPonto` importado de `@/types/api` em `RankingRow`; `ACERTOS` usa `as const` garantindo que `key` é keyof `RankingEntry`; `bolaoId: string` declarado na interface e passado pelo `page.tsx`.
