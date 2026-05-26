# Filtros por Estado e Redesenho do Card da Página de Jogos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar os filtros da página de Jogos de "por fase" para "por estado de aposta" (Todos / Pendentes / Apostados / Encerrados) e redesenhar o `JogoCard` para destacar o palpite do usuário, exibir a data/hora da aposta e mover o placar real para o rodapé.

**Architecture:** Toda a lógica de estado de aposta, filtragem, ordenação e formatação de data vive num módulo puro e testável (`lib/jogoEstado.ts`). O `JogoCard` e a página consomem esse módulo. A filtragem é 100% client-side: a página carrega `GET /jogos` uma única vez e filtra em memória. Nenhuma mudança de backend.

**Tech Stack:** Next.js 14 (App Router, client component), React 18, TypeScript, Jest + Testing Library, Tailwind.

**Spec:** `docs/superpowers/specs/2026-05-26-filtros-jogos-card-design.md`

---

## Estrutura de arquivos

- **Criar** `apps/frontend/src/lib/jogoEstado.ts` — lógica pura: `getEstadoAposta`, `jogoNoFiltro`, `ordenarPorFiltro`, `formatDataAposta`, tipos `EstadoAposta`/`FiltroJogo`.
- **Criar** `apps/frontend/src/__tests__/jogoEstado.test.ts` — testes unitários do módulo.
- **Criar** `apps/frontend/src/components/FiltroJogosChips.tsx` — chips dos 4 novos filtros (substitui `FaseFilterChips`).
- **Criar** `apps/frontend/src/__tests__/FiltroJogosChips.test.tsx` — testes dos chips.
- **Modificar** `apps/frontend/src/types/api.ts` — campo `atualizadoEm` em `Aposta`.
- **Modificar** `apps/frontend/src/components/JogoCard.tsx` — inversão palpite/placar, data/hora, remoção de "Aposte agora", usa o módulo.
- **Modificar** `apps/frontend/src/__tests__/JogoCard.test.tsx` — testes do novo layout.
- **Modificar** `apps/frontend/src/app/(app)/jogos/page.tsx` — carga única, filtro/ordenação client-side, filtro padrão Pendentes.
- **Remover** `apps/frontend/src/components/FaseFilterChips.tsx` e `apps/frontend/src/__tests__/FaseFilterChips.test.tsx`.

**Comando de teste:** rodar do diretório raiz. Um arquivo específico:
`pnpm --filter @bolao/frontend test -- <padrão>`

---

## Task 1: Módulo de estado/filtro/formatação + campo `atualizadoEm`

**Files:**
- Create: `apps/frontend/src/lib/jogoEstado.ts`
- Test: `apps/frontend/src/__tests__/jogoEstado.test.ts`
- Modify: `apps/frontend/src/types/api.ts` (interface `Aposta`)

- [ ] **Step 1: Adicionar `atualizadoEm` ao tipo `Aposta`**

Em `apps/frontend/src/types/api.ts`, na interface `Aposta` (linhas 50-57), adicionar o campo `atualizadoEm` após `pontuacao`:

```ts
export interface Aposta {
  id: string;
  jogoId: string;
  placarCasa: number;
  placarVisitante: number;
  pontuacao: number | null;
  atualizadoEm: string;
  jogo: Jogo;
}
```

- [ ] **Step 2: Escrever os testes que falham**

Criar `apps/frontend/src/__tests__/jogoEstado.test.ts`:

```ts
import {
  getEstadoAposta,
  jogoNoFiltro,
  ordenarPorFiltro,
  formatDataAposta,
} from '@/lib/jogoEstado';
import type { Jogo, Aposta } from '@/types/api';

const selecao = (nome: string) => ({
  id: nome, nome, codigo: nome.slice(0, 3).toUpperCase(), bandeiraSvg: '<svg></svg>',
});

const HORA_FUTURA = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
const HORA_PASSADA = new Date(Date.now() - 2 * 3600 * 1000).toISOString();

const jogo = (id: string, dataHora: string): Jogo => ({
  id, rodada: 1, grupo: 'A', fase: 'GRUPOS',
  placarCasa: null, placarVisitante: null, pesoPontuacao: 1,
  selecaoCasa: selecao('Brasil'), selecaoVisitante: selecao('Argentina'),
  dataHora,
});

const aposta = (jogoId: string): Aposta => ({
  id: 'a-' + jogoId, jogoId, placarCasa: 2, placarVisitante: 1,
  pontuacao: null, atualizadoEm: HORA_PASSADA, jogo: jogo(jogoId, HORA_FUTURA),
});

describe('getEstadoAposta', () => {
  it('aberto: prazo futuro sem aposta', () => {
    expect(getEstadoAposta(jogo('j', HORA_FUTURA))).toBe('aberto');
  });
  it('salvo: prazo futuro com aposta', () => {
    expect(getEstadoAposta(jogo('j', HORA_FUTURA), aposta('j'))).toBe('salvo');
  });
  it('incompleto: prazo passado sem aposta', () => {
    expect(getEstadoAposta(jogo('j', HORA_PASSADA))).toBe('incompleto');
  });
  it('fechado: prazo passado com aposta', () => {
    expect(getEstadoAposta(jogo('j', HORA_PASSADA), aposta('j'))).toBe('fechado');
  });
});

describe('jogoNoFiltro', () => {
  it('Todos aceita qualquer estado', () => {
    expect(jogoNoFiltro('aberto', 'Todos')).toBe(true);
    expect(jogoNoFiltro('incompleto', 'Todos')).toBe(true);
  });
  it('Pendentes aceita só aberto', () => {
    expect(jogoNoFiltro('aberto', 'Pendentes')).toBe(true);
    expect(jogoNoFiltro('salvo', 'Pendentes')).toBe(false);
  });
  it('Apostados aceita só salvo', () => {
    expect(jogoNoFiltro('salvo', 'Apostados')).toBe(true);
    expect(jogoNoFiltro('aberto', 'Apostados')).toBe(false);
  });
  it('Encerrados aceita fechado e incompleto', () => {
    expect(jogoNoFiltro('fechado', 'Encerrados')).toBe(true);
    expect(jogoNoFiltro('incompleto', 'Encerrados')).toBe(true);
    expect(jogoNoFiltro('salvo', 'Encerrados')).toBe(false);
  });
});

describe('ordenarPorFiltro', () => {
  const cedo = jogo('cedo', '2026-06-10T16:00:00.000Z');
  const tarde = jogo('tarde', '2026-06-12T16:00:00.000Z');

  it('crescente para Pendentes', () => {
    const r = ordenarPorFiltro([tarde, cedo], 'Pendentes');
    expect(r.map(j => j.id)).toEqual(['cedo', 'tarde']);
  });
  it('decrescente para Encerrados', () => {
    const r = ordenarPorFiltro([cedo, tarde], 'Encerrados');
    expect(r.map(j => j.id)).toEqual(['tarde', 'cedo']);
  });
  it('não muta o array original', () => {
    const orig = [tarde, cedo];
    ordenarPorFiltro(orig, 'Pendentes');
    expect(orig.map(j => j.id)).toEqual(['tarde', 'cedo']);
  });
});

describe('formatDataAposta', () => {
  it('formata dd/MM/yyyy HH:mm:ss', () => {
    const iso = new Date(2026, 5, 11, 13, 45, 25).toISOString();
    expect(formatDataAposta(iso)).toBe('11/06/2026 13:45:25');
  });
  it('zero-padding em dia/mês/hora', () => {
    const iso = new Date(2026, 0, 3, 9, 5, 7).toISOString();
    expect(formatDataAposta(iso)).toBe('03/01/2026 09:05:07');
  });
});
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `pnpm --filter @bolao/frontend test -- jogoEstado.test`
Expected: FAIL — "Cannot find module '@/lib/jogoEstado'".

- [ ] **Step 4: Implementar o módulo**

Criar `apps/frontend/src/lib/jogoEstado.ts`:

```ts
import type { Jogo, Aposta } from '@/types/api';
import { MINUTOS_PRAZO_APOSTA } from '@bolao/shared';

export type EstadoAposta = 'aberto' | 'salvo' | 'incompleto' | 'fechado';
export type FiltroJogo = 'Todos' | 'Pendentes' | 'Apostados' | 'Encerrados';

export function getEstadoAposta(jogo: Jogo, aposta?: Aposta): EstadoAposta {
  const prazo = new Date(jogo.dataHora).getTime() - MINUTOS_PRAZO_APOSTA * 60 * 1000;
  const estaFechado = Date.now() >= prazo;
  if (!estaFechado && !aposta) return 'aberto';
  if (!estaFechado && aposta) return 'salvo';
  if (estaFechado && aposta) return 'fechado';
  return 'incompleto';
}

export function jogoNoFiltro(estado: EstadoAposta, filtro: FiltroJogo): boolean {
  switch (filtro) {
    case 'Todos':
      return true;
    case 'Pendentes':
      return estado === 'aberto';
    case 'Apostados':
      return estado === 'salvo';
    case 'Encerrados':
      return estado === 'fechado' || estado === 'incompleto';
  }
}

export function ordenarPorFiltro(jogos: Jogo[], filtro: FiltroJogo): Jogo[] {
  const ordenado = [...jogos].sort(
    (a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime(),
  );
  return filtro === 'Encerrados' ? ordenado.reverse() : ordenado;
}

export function formatDataAposta(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `pnpm --filter @bolao/frontend test -- jogoEstado.test`
Expected: PASS (todos os describes).

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/lib/jogoEstado.ts apps/frontend/src/__tests__/jogoEstado.test.ts apps/frontend/src/types/api.ts
git commit -m "feat: módulo de estado/filtro/formatação de jogos e campo atualizadoEm"
```

---

## Task 2: Componente FiltroJogosChips

**Files:**
- Create: `apps/frontend/src/components/FiltroJogosChips.tsx`
- Test: `apps/frontend/src/__tests__/FiltroJogosChips.test.tsx`

- [ ] **Step 1: Escrever os testes que falham**

Criar `apps/frontend/src/__tests__/FiltroJogosChips.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { FiltroJogosChips } from '@/components/FiltroJogosChips';

it('renderiza os 4 filtros com rótulos legíveis', () => {
  render(<FiltroJogosChips selecionada="Todos" onChange={jest.fn()} />);
  expect(screen.getByText('Todos')).toBeInTheDocument();
  expect(screen.getByText('Pendentes de aposta')).toBeInTheDocument();
  expect(screen.getByText('Apostados')).toBeInTheDocument();
  expect(screen.getByText('Encerrados')).toBeInTheDocument();
});

it('chip selecionado tem destaque trovao-gold', () => {
  render(<FiltroJogosChips selecionada="Pendentes" onChange={jest.fn()} />);
  const chip = screen.getByText('Pendentes de aposta').closest('button');
  expect(chip?.className).toMatch(/trovao-gold/);
});

it('clique chama onChange com a chave do filtro', () => {
  const onChange = jest.fn();
  render(<FiltroJogosChips selecionada="Todos" onChange={onChange} />);
  fireEvent.click(screen.getByText('Encerrados'));
  expect(onChange).toHaveBeenCalledWith('Encerrados');
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `pnpm --filter @bolao/frontend test -- FiltroJogosChips.test`
Expected: FAIL — "Cannot find module '@/components/FiltroJogosChips'".

- [ ] **Step 3: Implementar o componente**

Criar `apps/frontend/src/components/FiltroJogosChips.tsx`:

```tsx
import type { FiltroJogo } from '@/lib/jogoEstado';

const FILTROS: FiltroJogo[] = ['Todos', 'Pendentes', 'Apostados', 'Encerrados'];

const FILTRO_LABELS: Record<FiltroJogo, string> = {
  Todos: 'Todos',
  Pendentes: 'Pendentes de aposta',
  Apostados: 'Apostados',
  Encerrados: 'Encerrados',
};

interface FiltroJogosChipsProps {
  selecionada: FiltroJogo;
  onChange: (filtro: FiltroJogo) => void;
}

export function FiltroJogosChips({ selecionada, onChange }: FiltroJogosChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {FILTROS.map(filtro => (
        <button
          key={filtro}
          onClick={() => onChange(filtro)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            selecionada === filtro
              ? 'bg-trovao-gold text-trovao-base'
              : 'bg-trovao-surface text-trovao-muted hover:text-white'
          }`}
        >
          {FILTRO_LABELS[filtro]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `pnpm --filter @bolao/frontend test -- FiltroJogosChips.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/FiltroJogosChips.tsx apps/frontend/src/__tests__/FiltroJogosChips.test.tsx
git commit -m "feat: chips de filtro por estado de aposta"
```

---

## Task 3: Redesenho do JogoCard

**Files:**
- Modify: `apps/frontend/src/components/JogoCard.tsx`
- Modify: `apps/frontend/src/__tests__/JogoCard.test.tsx`

- [ ] **Step 1: Reescrever os testes (vão falhar)**

Substituir TODO o conteúdo de `apps/frontend/src/__tests__/JogoCard.test.tsx` por:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { JogoCard } from '@/components/JogoCard';
import type { Jogo, Aposta } from '@/types/api';

const selecao = (nome: string) => ({
  id: nome, nome, codigo: nome.slice(0, 3).toUpperCase(), bandeiraSvg: '<svg></svg>',
});

const HORA_FUTURA = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
const HORA_PASSADA = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
const ATUALIZADO = new Date(2026, 5, 11, 13, 45, 25).toISOString();

const jogoBase: Jogo = {
  id: 'j1', rodada: 1, grupo: 'A', fase: 'GRUPOS',
  placarCasa: null, placarVisitante: null, pesoPontuacao: 1,
  selecaoCasa: selecao('Brasil'), selecaoVisitante: selecao('Argentina'),
  dataHora: HORA_FUTURA,
};

const apostaExemplo: Aposta = {
  id: 'a1', jogoId: 'j1',
  placarCasa: 2, placarVisitante: 1, pontuacao: null,
  atualizadoEm: ATUALIZADO, jogo: jogoBase,
};

it('aberto — mostra botão Apostar, palpite vazio, sem data', () => {
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA }} onApostar={jest.fn()} />);
  expect(screen.getByRole('button', { name: /apostar/i })).toBeInTheDocument();
  expect(screen.getByText('— : —')).toBeInTheDocument();
  expect(screen.queryByText('11/06/2026 13:45:25')).not.toBeInTheDocument();
  expect(screen.queryByText(/aposte agora/i)).not.toBeInTheDocument();
});

it('salvo — palpite central, data/hora da aposta e botão Editar', () => {
  render(
    <JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA }} aposta={apostaExemplo} onApostar={jest.fn()} />
  );
  expect(screen.getByText('Palpite')).toBeInTheDocument();
  expect(screen.getByText('2 : 1')).toBeInTheDocument();
  expect(screen.getByText('11/06/2026 13:45:25')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
});

it('incompleto — sem botão, sem texto "prazo encerrado"', () => {
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_PASSADA }} onApostar={jest.fn()} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByText(/prazo encerrado/i)).not.toBeInTheDocument();
  expect(screen.getByText('— : —')).toBeInTheDocument();
});

it('fechado com resultado — rodapé "Placar" com placar real e pontuação', () => {
  const jogoComPlacar = { ...jogoBase, dataHora: HORA_PASSADA, placarCasa: 1, placarVisitante: 1 };
  const apostaPontuada = { ...apostaExemplo, jogo: jogoComPlacar, pontuacao: 5 };
  render(<JogoCard jogo={jogoComPlacar} aposta={apostaPontuada} onApostar={jest.fn()} />);
  expect(screen.getByText('Placar:')).toBeInTheDocument();
  expect(screen.getByText('1 × 1')).toBeInTheDocument();
  expect(screen.getByText('+5 pts')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('sem resultado — não mostra rodapé "Placar"', () => {
  render(
    <JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA }} aposta={apostaExemplo} onApostar={jest.fn()} />
  );
  expect(screen.queryByText('Placar:')).not.toBeInTheDocument();
});

it('chama onApostar ao clicar no botão', () => {
  const onApostar = jest.fn();
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA }} onApostar={onApostar} />);
  fireEvent.click(screen.getByRole('button', { name: /apostar/i }));
  expect(onApostar).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `pnpm --filter @bolao/frontend test -- JogoCard.test`
Expected: FAIL (ex.: "Palpite" não encontrado; "— : —" presente em estado aberto ainda não — o card atual mostra placar do jogo, não palpite).

- [ ] **Step 3: Reescrever o JogoCard**

Substituir TODO o conteúdo de `apps/frontend/src/components/JogoCard.tsx` por:

```tsx
import type { Jogo, Aposta } from '@/types/api';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';
import { ScoreDisplay } from '@/components/ScoreDisplay';
import { getEstadoAposta, formatDataAposta, type EstadoAposta } from '@/lib/jogoEstado';

const ESTADO_BORDER: Record<EstadoAposta, string> = {
  aberto:    'border-trovao-border hover:border-trovao-green/40',
  salvo:     'border-trovao-green',
  incompleto:'border-trovao-gold',
  fechado:   'border-trovao-border opacity-60',
};

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

interface JogoCardProps {
  jogo: Jogo;
  aposta?: Aposta;
  onApostar?: () => void;
}

export function JogoCard({ jogo, aposta, onApostar }: JogoCardProps) {
  const estado = getEstadoAposta(jogo, aposta);
  const temResultado = jogo.placarCasa !== null && jogo.placarVisitante !== null;

  return (
    <div className={`bg-trovao-card border rounded-xl p-4 space-y-3 transition-colors ${ESTADO_BORDER[estado]}`}>
      {/* Header */}
      <div className="flex justify-between items-center text-xs text-trovao-muted">
        <span>{jogo.fase}{jogo.grupo ? ` · Grupo ${jogo.grupo}` : ''} · R{jogo.rodada}</span>
        <span>{formatHora(jogo.dataHora)}</span>
      </div>

      {/* Times + palpite central */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col items-center gap-1 flex-1">
          <SelecaoAvatar nome={jogo.selecaoCasa.nome} bandeiraSvg={jogo.selecaoCasa.bandeiraSvg} size="md" />
          <p className="text-xs font-semibold text-white">{jogo.selecaoCasa.codigo}</p>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <ScoreDisplay
            placarCasa={aposta?.placarCasa ?? null}
            placarVisitante={aposta?.placarVisitante ?? null}
          />
          <span className="text-trovao-muted text-[10px] uppercase tracking-wider">Palpite</span>
          {aposta && (
            <span className="text-trovao-muted text-[10px]">{formatDataAposta(aposta.atualizadoEm)}</span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 flex-1">
          <SelecaoAvatar nome={jogo.selecaoVisitante.nome} bandeiraSvg={jogo.selecaoVisitante.bandeiraSvg} size="md" />
          <p className="text-xs font-semibold text-white">{jogo.selecaoVisitante.codigo}</p>
        </div>
      </div>

      {/* Rodapé: placar real do jogo */}
      {temResultado && (
        <div className="border-t border-trovao-border pt-2 flex items-center justify-between text-xs">
          <span className="text-trovao-muted">Placar:</span>
          <span className="text-white font-mono font-semibold">
            {jogo.placarCasa} × {jogo.placarVisitante}
          </span>
          {aposta?.pontuacao != null && (
            <span className="text-trovao-gold font-bold">+{aposta.pontuacao} pts</span>
          )}
        </div>
      )}

      {/* Botão de aposta */}
      {(estado === 'aberto' || estado === 'salvo') && onApostar && (
        <button
          onClick={onApostar}
          className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${
            estado === 'salvo'
              ? 'bg-trovao-surface text-trovao-green border border-trovao-green hover:bg-trovao-green/10'
              : 'bg-trovao-gold text-trovao-base hover:bg-trovao-gold/90'
          }`}
        >
          {estado === 'salvo' ? 'Editar palpite' : 'Apostar'}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `pnpm --filter @bolao/frontend test -- JogoCard.test`
Expected: PASS (todos os 6 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/JogoCard.tsx apps/frontend/src/__tests__/JogoCard.test.tsx
git commit -m "feat: card de jogo destaca palpite, data da aposta e placar real no rodapé"
```

---

## Task 4: Página de Jogos — filtro/ordenação client-side

**Files:**
- Modify: `apps/frontend/src/app/(app)/jogos/page.tsx`
- Remove: `apps/frontend/src/components/FaseFilterChips.tsx`
- Remove: `apps/frontend/src/__tests__/FaseFilterChips.test.tsx`

- [ ] **Step 1: Confirmar que nada mais importa FaseFilterChips**

Run (Grep): procurar `FaseFilterChips` em `apps/frontend/src`.
Expected: apenas `jogos/page.tsx` (import a ser trocado) e o arquivo do componente/teste (a serem removidos). Se houver outro consumidor, atualizar também.

- [ ] **Step 2: Reescrever a página**

Substituir TODO o conteúdo de `apps/frontend/src/app/(app)/jogos/page.tsx` por:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { JogoCard } from '@/components/JogoCard';
import { ApostaDrawer } from '@/components/ApostaDrawer';
import { FiltroJogosChips } from '@/components/FiltroJogosChips';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import type { Jogo, Aposta } from '@/types/api';
import {
  getEstadoAposta, jogoNoFiltro, ordenarPorFiltro, type FiltroJogo,
} from '@/lib/jogoEstado';

function agruparPorData(jogos: Jogo[]): Map<string, Jogo[]> {
  const grupos = new Map<string, Jogo[]>();
  for (const jogo of jogos) {
    const chave = new Date(jogo.dataHora).toLocaleDateString('pt-BR', {
      weekday: 'short', day: '2-digit', month: '2-digit',
    });
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(jogo);
  }
  return grupos;
}

export default function JogosPage() {
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [apostas, setApostas] = useState<Map<string, Aposta>>(new Map());
  const [filtro, setFiltro] = useState<FiltroJogo>('Pendentes');
  const [jogoSelecionado, setJogoSelecionado] = useState<Jogo | null>(null);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    const [jogosData, apostasData] = await Promise.all([
      api.get<Jogo[]>('/jogos').catch(() => [] as Jogo[]),
      api.get<Aposta[]>('/apostas').catch(() => [] as Aposta[]),
    ]);
    setJogos(jogosData);
    setApostas(new Map(apostasData.map(a => [a.jogoId, a])));
    setLoading(false);
  }

  async function recarregarApostas() {
    const apostasData = await api.get<Aposta[]>('/apostas').catch(() => [] as Aposta[]);
    setApostas(new Map(apostasData.map(a => [a.jogoId, a])));
  }

  useEffect(() => { carregar(); }, []);

  const jogosFiltrados = ordenarPorFiltro(
    jogos.filter(j => jogoNoFiltro(getEstadoAposta(j, apostas.get(j.id)), filtro)),
    filtro,
  );
  const grupos = agruparPorData(jogosFiltrados);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Jogos</h1>

      <FiltroJogosChips selecionada={filtro} onChange={setFiltro} />

      {loading ? (
        <PageSkeleton />
      ) : jogosFiltrados.length === 0 ? (
        <EmptyState titulo="Nenhum jogo" descricao="Não há jogos para este filtro." />
      ) : (
        <div className="space-y-6">
          {Array.from(grupos.entries()).map(([data, jogosGrupo]) => (
            <div key={data}>
              <h2 className="text-trovao-muted text-[10px] font-semibold uppercase tracking-wider mb-2 px-1">
                {data}
              </h2>
              <div className="space-y-3">
                {jogosGrupo.map(jogo => (
                  <JogoCard
                    key={jogo.id}
                    jogo={jogo}
                    aposta={apostas.get(jogo.id)}
                    onApostar={() => setJogoSelecionado(jogo)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {jogoSelecionado && (
        <ApostaDrawer
          key={jogoSelecionado.id}
          jogo={jogoSelecionado}
          aposta={apostas.get(jogoSelecionado.id)}
          aberto={true}
          onFechar={() => setJogoSelecionado(null)}
          onSalvo={recarregarApostas}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Remover o componente antigo e seu teste**

```bash
git rm apps/frontend/src/components/FaseFilterChips.tsx apps/frontend/src/__tests__/FaseFilterChips.test.tsx
```

- [ ] **Step 4: Rodar a suíte completa do frontend**

Run: `pnpm --filter @bolao/frontend test`
Expected: PASS, sem referências quebradas a `FaseFilterChips`.

- [ ] **Step 5: Verificação manual no navegador**

1. Subir o app (infra + dev): `pnpm dev` (ou conforme o fluxo do projeto).
2. Abrir a página de Jogos. Confirmar:
   - Filtro padrão **Pendentes de aposta** já selecionado.
   - Chips: Todos / Pendentes de aposta / Apostados / Encerrados.
   - Em **Pendentes**: só jogos com prazo aberto e sem palpite; card mostra `— : —`, "Palpite", e botão **Apostar** (sem "Aposte agora").
   - Após apostar, o jogo sai de Pendentes e aparece em **Apostados**, com placar central = palpite, data/hora `dd/MM/yyyy HH:mm:ss` e botão **Editar palpite**.
   - **Encerrados**: jogos com prazo fechado, ordem **decrescente** (mais recente no topo); rodapé "Placar:" com resultado real quando lançado; jogos sem palpite mostram `— : —` com borda dourada.
   - Demais filtros em ordem crescente.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/app/(app)/jogos/page.tsx
git commit -m "feat: filtros por estado de aposta na página de jogos com ordenação client-side"
```

---

## Self-Review (preenchido pelo autor do plano)

- **Cobertura do spec:** filtros por estado (Task 4 + lógica Task 1); filtragem client-side e carga única (Task 4); padrão Pendentes (Task 4); ordenação Encerrados desc / demais asc (Task 1 `ordenarPorFiltro` + Task 4); inversão palpite/placar, data/hora, remoção de "Aposte agora", rótulo "Placar", `+pts` (Task 3); legenda "Palpite" e remoção de "prazo encerrado" (Task 3); campo `atualizadoEm` (Task 1); rename do componente de chips (Task 2 + Task 4). Todos os itens do spec têm task.
- **Placeholders:** nenhum — todo passo de código tem o código completo.
- **Consistência de tipos:** `EstadoAposta` e `FiltroJogo` definidos na Task 1 e usados igualmente em Tasks 2-4; `getEstadoAposta`/`jogoNoFiltro`/`ordenarPorFiltro`/`formatDataAposta` com assinaturas idênticas em todos os consumidores; `Aposta.atualizadoEm: string` definido na Task 1 e consumido na Task 3.
