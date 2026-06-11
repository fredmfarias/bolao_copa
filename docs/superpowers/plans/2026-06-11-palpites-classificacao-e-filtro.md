# Palpites por classificação + filtro de placar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na tela `boloes/<bolaoId>/palpites/<jogoId>`, ordenar os palpites pela classificação do usuário no bolão, destacar os top 5 com o estilo das medalhas do ranking, e adicionar um filtro client-side por placar (chips com contagem).

**Architecture:** Join client-side entre os palpites (já carregados) e o ranking (`GET /boloes/:bolaoId/ranking`). Os tokens de medalha saem de `RankingRow.tsx` para um módulo compartilhado `lib/medalhas.ts`. Helpers puros de ordenação/contagem ficam em `lib/palpites.ts`. Dois componentes novos (`PalpiteRow`, `PlacarFiltro`) renderizam a linha e o filtro. Sem mudanças no backend.

**Tech Stack:** Next.js (App Router, client components), React, TypeScript, Tailwind CSS, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-11-palpites-classificacao-e-filtro-design.md`

---

## File Structure

- **Create** `apps/frontend/src/lib/medalhas.ts` — mapa `MEDALHAS` (fonte única do estilo metálico top 5).
- **Create** `apps/frontend/src/lib/palpites.ts` — helpers puros: `placarKey`, `contarPlacares`, `ordenarPorClassificacao`.
- **Create** `apps/frontend/src/components/PalpiteRow.tsx` — linha de um palpite (posição + medalha + placar).
- **Create** `apps/frontend/src/components/PlacarFiltro.tsx` — chips de filtro por placar.
- **Modify** `apps/frontend/src/components/RankingRow.tsx` — importar `MEDALHAS` do módulo novo.
- **Modify** `apps/frontend/src/types/api.ts` — exportar interface `Palpite`.
- **Modify** `apps/frontend/src/app/(app)/boloes/[id]/palpites/[jogoId]/page.tsx` — buscar ranking, ordenar, estado do filtro, usar os componentes novos.
- **Create** `apps/frontend/src/__tests__/palpites.test.ts` — testes dos helpers.
- **Create** `apps/frontend/src/__tests__/PlacarFiltro.test.tsx` — testes do filtro.
- **Create** `apps/frontend/src/__tests__/PalpiteRow.test.tsx` — testes da linha.

**Nota sobre comandos:** todos os comandos `npm` rodam a partir de `apps/frontend`. Os exemplos usam `npm --prefix apps/frontend ...` para rodar de qualquer diretório.

---

## Task 1: Extrair `MEDALHAS` para módulo compartilhado

Refactor sem mudança de comportamento. A suíte atual de `RankingRow` deve continuar passando.

**Files:**
- Create: `apps/frontend/src/lib/medalhas.ts`
- Modify: `apps/frontend/src/components/RankingRow.tsx:17-26` (remove o const local) e topo do arquivo (add import)
- Test: `apps/frontend/src/__tests__/RankingRow.test.tsx` (já existe; serve de rede de segurança)

- [ ] **Step 1: Criar o módulo `lib/medalhas.ts`**

```ts
// Destaque metálico dos 5 primeiros colocados. Classes literais para o
// Tailwind não fazer purge (nada de montar `border-trovao-${metal}`).
export const MEDALHAS: Record<number, { border: string; texto: string }> = {
  1: { border: 'border-trovao-gold/70',   texto: 'text-trovao-gold'      },
  2: { border: 'border-trovao-silver/70', texto: 'text-trovao-silver'    },
  3: { border: 'border-trovao-bronze/70', texto: 'text-trovao-bronze'    },
  // 4º e 5º: degradê esmaecido do bronze.
  4: { border: 'border-trovao-bronze/45', texto: 'text-trovao-bronze/80' },
  5: { border: 'border-trovao-bronze/25', texto: 'text-trovao-bronze/55' },
};
```

- [ ] **Step 2: Importar em `RankingRow.tsx` e remover o const local**

No topo do arquivo, depois dos imports existentes, adicione:

```ts
import { MEDALHAS } from '@/lib/medalhas';
```

Remova o bloco local (atualmente linhas 17-26):

```ts
// Destaque metálico dos 5 primeiros colocados. Classes literais para o
// Tailwind não fazer purge (nada de montar `border-trovao-${metal}`).
const MEDALHAS: Record<number, { border: string; texto: string }> = {
  1: { border: 'border-trovao-gold/70',   texto: 'text-trovao-gold'      },
  2: { border: 'border-trovao-silver/70', texto: 'text-trovao-silver'    },
  3: { border: 'border-trovao-bronze/70', texto: 'text-trovao-bronze'    },
  // 4º e 5º: degradê esmaecido do bronze.
  4: { border: 'border-trovao-bronze/45', texto: 'text-trovao-bronze/80' },
  5: { border: 'border-trovao-bronze/25', texto: 'text-trovao-bronze/55' },
};
```

O resto de `RankingRow.tsx` (que usa `MEDALHAS[posicaoExibida]`) fica inalterado.

- [ ] **Step 3: Rodar os testes do RankingRow para garantir que nada quebrou**

Run: `npm --prefix apps/frontend test -- RankingRow`
Expected: PASS (todos os testes do `RankingRow.test.tsx` verdes).

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/lib/medalhas.ts apps/frontend/src/components/RankingRow.tsx
git commit -m "refactor: extrai mapa MEDALHAS para lib/medalhas"
```

---

## Task 2: Exportar a interface `Palpite`

A interface hoje vive inline em `page.tsx`. Move para `types/api.ts` para os componentes e helpers reusarem.

**Files:**
- Modify: `apps/frontend/src/types/api.ts` (add interface, depois do bloco `Aposta`)

- [ ] **Step 1: Adicionar a interface `Palpite` em `types/api.ts`**

Logo após a interface `Aposta` (termina em torno da linha 61), adicione:

```ts
export interface Palpite {
  usuarioId: string;
  nome: string;
  avatarUrl: string | null;
  placarCasa: number;
  placarVisitante: number;
  pontuacao: number | null;
}
```

- [ ] **Step 2: Verificar typecheck/build do tipo**

Run: `npm --prefix apps/frontend run lint`
Expected: sem erros novos relacionados a `types/api.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/types/api.ts
git commit -m "refactor: exporta interface Palpite em types/api"
```

---

## Task 3: Helpers puros em `lib/palpites.ts` (TDD)

Funções puras e testáveis: chave de placar, contagem por placar e ordenação por classificação.

**Files:**
- Create: `apps/frontend/src/lib/palpites.ts`
- Test: `apps/frontend/src/__tests__/palpites.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Crie `apps/frontend/src/__tests__/palpites.test.ts`:

```ts
import { placarKey, contarPlacares, ordenarPorClassificacao } from '@/lib/palpites';
import type { Palpite } from '@/types/api';

const mk = (over: Partial<Palpite>): Palpite => ({
  usuarioId: 'u', nome: 'X', avatarUrl: null,
  placarCasa: 0, placarVisitante: 0, pontuacao: null, ...over,
});

describe('placarKey', () => {
  it('monta a chave casaxvisitante', () => {
    expect(placarKey(mk({ placarCasa: 2, placarVisitante: 1 }))).toBe('2x1');
  });
});

describe('contarPlacares', () => {
  it('agrupa placares distintos e ordena por contagem desc', () => {
    const r = contarPlacares([
      mk({ placarCasa: 2, placarVisitante: 1 }),
      mk({ placarCasa: 2, placarVisitante: 1 }),
      mk({ placarCasa: 1, placarVisitante: 0 }),
    ]);
    expect(r).toEqual([
      { key: '2x1', casa: 2, visitante: 1, count: 2 },
      { key: '1x0', casa: 1, visitante: 0, count: 1 },
    ]);
  });

  it('lista vazia retorna []', () => {
    expect(contarPlacares([])).toEqual([]);
  });
});

describe('ordenarPorClassificacao', () => {
  it('ordena por posição e joga não ranqueados pro fim mantendo a ordem original', () => {
    const a = mk({ usuarioId: 'a' });
    const b = mk({ usuarioId: 'b' });
    const c = mk({ usuarioId: 'c' });
    const posicoes = new Map([['b', 1], ['a', 3]]);
    const r = ordenarPorClassificacao([a, b, c], posicoes);
    expect(r.map((x) => x.palpite.usuarioId)).toEqual(['b', 'a', 'c']);
    expect(r.map((x) => x.posicao)).toEqual([1, 3, undefined]);
  });

  it('sem ranking, preserva a ordem original e posicao undefined', () => {
    const a = mk({ usuarioId: 'a' });
    const b = mk({ usuarioId: 'b' });
    const r = ordenarPorClassificacao([a, b], new Map());
    expect(r.map((x) => x.palpite.usuarioId)).toEqual(['a', 'b']);
    expect(r.map((x) => x.posicao)).toEqual([undefined, undefined]);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm --prefix apps/frontend test -- palpites`
Expected: FAIL com "Cannot find module '@/lib/palpites'".

- [ ] **Step 3: Implementar `lib/palpites.ts`**

```ts
import type { Palpite } from '@/types/api';

export interface PlacarContagem {
  key: string;
  casa: number;
  visitante: number;
  count: number;
}

export interface PalpiteOrdenado {
  palpite: Palpite;
  posicao?: number;
}

export function placarKey(p: { placarCasa: number; placarVisitante: number }): string {
  return `${p.placarCasa}x${p.placarVisitante}`;
}

export function contarPlacares(palpites: Palpite[]): PlacarContagem[] {
  const mapa = new Map<string, PlacarContagem>();
  for (const p of palpites) {
    const key = placarKey(p);
    const existente = mapa.get(key);
    if (existente) {
      existente.count++;
    } else {
      mapa.set(key, { key, casa: p.placarCasa, visitante: p.placarVisitante, count: 1 });
    }
  }
  return [...mapa.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function ordenarPorClassificacao(
  palpites: Palpite[],
  posicoes: Map<string, number>,
): PalpiteOrdenado[] {
  // Array.prototype.sort é estável: não ranqueados (Infinity) mantêm a ordem do backend.
  return palpites
    .map((palpite) => ({ palpite, posicao: posicoes.get(palpite.usuarioId) }))
    .sort((a, b) => (a.posicao ?? Infinity) - (b.posicao ?? Infinity));
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm --prefix apps/frontend test -- palpites`
Expected: PASS (todos os blocos verdes).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/lib/palpites.ts apps/frontend/src/__tests__/palpites.test.ts
git commit -m "feat: helpers de ordenação e contagem de palpites"
```

---

## Task 4: Componente `PlacarFiltro` (TDD)

Chips de filtro por placar. Não renderiza nada com 0 ou 1 placar distinto.

**Files:**
- Create: `apps/frontend/src/components/PlacarFiltro.tsx`
- Test: `apps/frontend/src/__tests__/PlacarFiltro.test.tsx`

- [ ] **Step 1: Escrever os testes que falham**

Crie `apps/frontend/src/__tests__/PlacarFiltro.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PlacarFiltro } from '@/components/PlacarFiltro';
import type { Palpite } from '@/types/api';

let seq = 0;
const mk = (casa: number, visitante: number): Palpite => ({
  usuarioId: `u${seq++}`, nome: 'X', avatarUrl: null,
  placarCasa: casa, placarVisitante: visitante, pontuacao: null,
});

it('não renderiza com 0 ou 1 placar distinto', () => {
  const { container } = render(
    <PlacarFiltro palpites={[mk(2, 1), mk(2, 1)]} value={null} onChange={() => {}} />,
  );
  expect(container.firstChild).toBeNull();
});

it('exibe chip Todos e um chip por placar com contagem', () => {
  render(
    <PlacarFiltro palpites={[mk(2, 1), mk(2, 1), mk(1, 0)]} value={null} onChange={() => {}} />,
  );
  expect(screen.getByText('Todos')).toBeInTheDocument();
  expect(screen.getByText('2 × 1')).toBeInTheDocument();
  expect(screen.getByText('· 2')).toBeInTheDocument();
  expect(screen.getByText('1 × 0')).toBeInTheDocument();
});

it('chama onChange com a key ao clicar num placar', () => {
  const onChange = jest.fn();
  render(<PlacarFiltro palpites={[mk(2, 1), mk(1, 0)]} value={null} onChange={onChange} />);
  fireEvent.click(screen.getByText('1 × 0'));
  expect(onChange).toHaveBeenCalledWith('1x0');
});

it('chama onChange com null ao clicar em Todos', () => {
  const onChange = jest.fn();
  render(<PlacarFiltro palpites={[mk(2, 1), mk(1, 0)]} value="2x1" onChange={onChange} />);
  fireEvent.click(screen.getByText('Todos'));
  expect(onChange).toHaveBeenCalledWith(null);
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm --prefix apps/frontend test -- PlacarFiltro`
Expected: FAIL com "Cannot find module '@/components/PlacarFiltro'".

- [ ] **Step 3: Implementar `components/PlacarFiltro.tsx`**

```tsx
import { contarPlacares } from '@/lib/palpites';
import type { Palpite } from '@/types/api';

interface PlacarFiltroProps {
  palpites: Palpite[];
  value: string | null;
  onChange: (value: string | null) => void;
}

function chipClass(ativo: boolean): string {
  return `px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
    ativo
      ? 'bg-trovao-gold text-trovao-base border-trovao-gold'
      : 'bg-trovao-surface text-trovao-muted border-trovao-border hover:border-trovao-gold'
  }`;
}

export function PlacarFiltro({ palpites, value, onChange }: PlacarFiltroProps) {
  const placares = contarPlacares(palpites);
  if (placares.length <= 1) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      <button type="button" onClick={() => onChange(null)} className={chipClass(value === null)}>
        Todos
      </button>
      {placares.map((pl) => (
        <button
          key={pl.key}
          type="button"
          onClick={() => onChange(pl.key)}
          className={chipClass(value === pl.key)}
        >
          {pl.casa} × {pl.visitante}
          <span className="ml-1 opacity-70">· {pl.count}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm --prefix apps/frontend test -- PlacarFiltro`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/PlacarFiltro.tsx apps/frontend/src/__tests__/PlacarFiltro.test.tsx
git commit -m "feat: componente PlacarFiltro (chips por placar)"
```

---

## Task 5: Componente `PalpiteRow` (TDD)

Linha de um palpite, com posição opcional e destaque metálico do top 5.

**Files:**
- Create: `apps/frontend/src/components/PalpiteRow.tsx`
- Test: `apps/frontend/src/__tests__/PalpiteRow.test.tsx`

- [ ] **Step 1: Escrever os testes que falham**

Crie `apps/frontend/src/__tests__/PalpiteRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { PalpiteRow } from '@/components/PalpiteRow';
import type { Palpite, Jogo } from '@/types/api';

const jogo = {
  selecaoCasa: { nome: 'Brasil', codigo: 'BRA', bandeiraSvg: 'bra.svg' },
  selecaoVisitante: { nome: 'Argentina', codigo: 'ARG', bandeiraSvg: 'arg.svg' },
} as unknown as Jogo;

const palpite: Palpite = {
  usuarioId: 'u1', nome: 'Diego', avatarUrl: null,
  placarCasa: 2, placarVisitante: 1, pontuacao: 7,
};

it('exibe nome, placar e pontuação', () => {
  render(<PalpiteRow palpite={palpite} jogo={jogo} isMe={false} />);
  expect(screen.getByText('Diego')).toBeInTheDocument();
  expect(screen.getByText('2 × 1')).toBeInTheDocument();
  expect(screen.getByText('+7')).toBeInTheDocument();
});

it('sem posição, não mostra número nem cor metálica', () => {
  const { container } = render(<PalpiteRow palpite={palpite} jogo={jogo} isMe={false} />);
  expect(screen.queryByText('1º')).not.toBeInTheDocument();
  expect((container.firstChild as HTMLElement).className).toMatch('border-trovao-border');
});

it.each([[1, 'gold'], [2, 'silver'], [3, 'bronze']])(
  'posição %iº usa a cor %s na borda e no número',
  (posicao, metal) => {
    const { container } = render(
      <PalpiteRow palpite={palpite} jogo={jogo} posicao={posicao} isMe={false} />,
    );
    expect((container.firstChild as HTMLElement).className).toMatch(`border-trovao-${metal}`);
    expect(screen.getByText(`${posicao}º`).className).toMatch(`text-trovao-${metal}`);
  },
);

it('posição fora do top 5 mostra o número sem cor metálica', () => {
  render(<PalpiteRow palpite={palpite} jogo={jogo} posicao={7} isMe={false} />);
  expect(screen.getByText('7º').className).toMatch('text-trovao-muted');
});

it('destaca o próprio usuário com ring dourado', () => {
  const { container } = render(<PalpiteRow palpite={palpite} jogo={jogo} posicao={2} isMe />);
  expect((container.firstChild as HTMLElement).className).toMatch('ring-trovao-gold');
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm --prefix apps/frontend test -- PalpiteRow`
Expected: FAIL com "Cannot find module '@/components/PalpiteRow'".

- [ ] **Step 3: Implementar `components/PalpiteRow.tsx`**

```tsx
import { SelecaoAvatar } from './SelecaoAvatar';
import { MEDALHAS } from '@/lib/medalhas';
import type { Palpite, Jogo } from '@/types/api';

interface PalpiteRowProps {
  palpite: Palpite;
  jogo: Jogo;
  posicao?: number;
  isMe: boolean;
}

export function PalpiteRow({ palpite: p, jogo, posicao, isMe }: PalpiteRowProps) {
  const medalha = posicao !== undefined ? MEDALHAS[posicao] : undefined;

  return (
    <div
      className={`flex items-center justify-between px-4 py-3 rounded-xl bg-trovao-card border ${
        medalha ? medalha.border : 'border-trovao-border'
      } ${isMe ? 'ring-2 ring-trovao-gold/60' : ''}`}
    >
      <div className="flex items-center gap-2">
        {posicao !== undefined && (
          <span
            className={`text-sm w-7 flex-shrink-0 ${
              medalha ? `${medalha.texto} font-bold` : 'text-trovao-muted'
            }`}
          >
            {posicao}º
          </span>
        )}
        {p.avatarUrl ? (
          <img src={p.avatarUrl} alt={p.nome} className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-trovao-surface flex items-center justify-center text-xs font-bold text-trovao-muted">
            {p.nome.charAt(0).toUpperCase()}
          </div>
        )}
        <span className={`text-sm font-medium ${isMe ? 'text-trovao-gold' : 'text-white'}`}>
          {p.nome}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-white font-mono text-sm font-semibold">
          <SelecaoAvatar nome={jogo.selecaoCasa.nome} bandeiraSvg={jogo.selecaoCasa.bandeiraSvg} size="sm" shape="rect" />
          {p.placarCasa} × {p.placarVisitante}
          <SelecaoAvatar nome={jogo.selecaoVisitante.nome} bandeiraSvg={jogo.selecaoVisitante.bandeiraSvg} size="sm" shape="rect" />
        </span>
        {p.pontuacao !== null && (
          <span className="text-trovao-gold text-sm font-bold tabular-nums">+{p.pontuacao}</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm --prefix apps/frontend test -- PalpiteRow`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/PalpiteRow.tsx apps/frontend/src/__tests__/PalpiteRow.test.tsx
git commit -m "feat: componente PalpiteRow com destaque do top 5"
```

---

## Task 6: Integrar na página de palpites

Buscar o ranking, ordenar por classificação, adicionar estado do filtro e usar os componentes novos.

**Files:**
- Modify: `apps/frontend/src/app/(app)/boloes/[id]/palpites/[jogoId]/page.tsx`

- [ ] **Step 1: Atualizar imports e remover a interface `Palpite` inline**

No topo do arquivo, substitua o bloco de imports e a interface local. O bloco atual (linhas 1-25) tem a interface `Palpite` inline e `function prazoEncerrado`. Faça duas mudanças:

1. Ajuste os imports para incluir `useAuth`, os componentes novos, os helpers e os tipos:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';
import { PalpiteRow } from '@/components/PalpiteRow';
import { PlacarFiltro } from '@/components/PlacarFiltro';
import { ordenarPorClassificacao, placarKey } from '@/lib/palpites';
import { MINUTOS_PRAZO_APOSTA, BOLAO_GLOBAL_ID } from '@bolao/shared';
import type { Bolao, Jogo, Palpite, RankingEntry } from '@/types/api';
```

2. Remova a interface `Palpite` inline (atualmente linhas 13-20):

```tsx
interface Palpite {
  usuarioId: string;
  nome: string;
  avatarUrl: string | null;
  placarCasa: number;
  placarVisitante: number;
  pontuacao: number | null;
}
```

Mantenha a `function prazoEncerrado(dataHora: string)` como está.

- [ ] **Step 2: Adicionar estado e buscar o ranking junto com os palpites**

Dentro de `PalpitesPage`, adicione o hook de auth e os dois estados novos junto aos `useState` existentes:

```tsx
const { user } = useAuth();
const [posicoes, setPosicoes] = useState<Map<string, number>>(new Map());
const [placarFiltro, setPlacarFiltro] = useState<string | null>(null);
```

Substitua o `useEffect` atual (linhas ~36-51) por esta versão, que busca o ranking em paralelo com as apostas e reseta o filtro:

```tsx
useEffect(() => {
  Promise.all([
    api.get<Jogo>(`/jogos/${jogoId}`).catch(() => null),
    api.get<Bolao[]>('/boloes/meus').catch(() => [] as Bolao[]),
  ]).then(([j, bs]) => {
    setJogo(j);
    setBoloes(bs);
    setPlacarFiltro(null);
    if (j && prazoEncerrado(j.dataHora)) {
      setPrazoPassou(true);
      Promise.all([
        api.get<Palpite[]>(`/boloes/${bolaoId}/apostas?jogoId=${jogoId}`).catch(() => [] as Palpite[]),
        api.get<RankingEntry[]>(`/boloes/${bolaoId}/ranking`).catch(() => [] as RankingEntry[]),
      ]).then(([ps, ranking]) => {
        setPalpites(ps);
        setPosicoes(new Map(ranking.map((r) => [r.usuarioId, r.posicao])));
      });
    }
    setLoading(false);
  });
}, [bolaoId, jogoId]);
```

- [ ] **Step 3: Derivar a lista ordenada e filtrada e renderizar os componentes novos**

Logo após `function navegarBolao(...)` (antes do `return`), adicione as listas derivadas:

```tsx
const ordenados = ordenarPorClassificacao(palpites, posicoes);
const visiveis = placarFiltro === null
  ? ordenados
  : ordenados.filter(({ palpite }) => placarKey(palpite) === placarFiltro);
```

Substitua o bloco de conteúdo dos palpites (o ramo `) : (` final, atualmente linhas ~130-160) por:

```tsx
) : (
  <div className="space-y-3">
    <PlacarFiltro palpites={palpites} value={placarFiltro} onChange={setPlacarFiltro} />
    <div className="space-y-2">
      <p className="text-trovao-muted text-xs px-1">{visiveis.length} palpites</p>
      {visiveis.map(({ palpite, posicao }) => (
        <PalpiteRow
          key={palpite.usuarioId}
          palpite={palpite}
          jogo={jogo}
          posicao={posicao}
          isMe={palpite.usuarioId === user?.id}
        />
      ))}
    </div>
  </div>
)
```

> Nota: `SelecaoAvatar` continua importado porque o cabeçalho do jogo ainda o usa. Não remova esse import.

- [ ] **Step 4: Verificar lint/typecheck**

Run: `npm --prefix apps/frontend run lint`
Expected: sem erros (sem variáveis não usadas, sem tipos faltando).

- [ ] **Step 5: Rodar a suíte completa de testes**

Run: `npm --prefix apps/frontend test`
Expected: PASS — incluindo `RankingRow`, `palpites`, `PlacarFiltro`, `PalpiteRow`.

- [ ] **Step 6: Conferência visual no dev server**

Run: `npm --prefix apps/frontend run dev`
Confira em `boloes/<bolaoId>/palpites/<jogoId>` (um jogo com prazo encerrado):
- Palpites ordenados pela classificação; top 5 com bordas/números metálicos; seu palpite com ring dourado.
- Chips de placar aparecem (quando há ≥2 placares distintos); clicar filtra; contador "N palpites" acompanha.
- Bolão sem ranking publicado: lista funciona normal, sem números nem medalhas.

- [ ] **Step 7: Commit**

```bash
git add "apps/frontend/src/app/(app)/boloes/[id]/palpites/[jogoId]/page.tsx"
git commit -m "feat: ordena palpites por classificação e filtra por placar"
```

---

## Self-Review (do autor do plano)

**Spec coverage:**
- Ordenar por classificação → Task 3 (`ordenarPorClassificacao`) + Task 6 (integração). ✅
- Destacar top 5 com estilo do ranking → Task 1 (`MEDALHAS` compartilhado) + Task 5 (`PalpiteRow`). ✅
- Mostrar número da posição → Task 5 (`PalpiteRow`). ✅
- Filtro client-side por placar com chips + contagem, DS do bolão → Task 4 (`PlacarFiltro`) + Task 6. ✅
- Funciona sem ranking publicado → Task 3 (fallback) + testes em Task 3/5/6 Step 6. ✅
- Posições/medalhas pela classificação real, não recalculadas no subconjunto filtrado → Task 6 (filtro aplicado depois da ordenação, `posicao` vem do ranking). ✅
- Sem mudanças no backend → nenhuma task toca `apps/backend`. ✅
- `RankingTable.tsx` intocado → não referenciado. ✅

**Placeholder scan:** sem TBD/TODO; todo passo de código tem o código completo.

**Type consistency:** `Palpite` (Task 2) usado em Tasks 3/4/5/6; `PlacarContagem`/`PalpiteOrdenado` (Task 3) consistentes; `MEDALHAS` (Task 1) importado em Task 5; props `PalpiteRow`/`PlacarFiltro` batem entre definição e uso na página.
