# View de Distribuição de Placares Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar aba "Meus Placares" à página de Jogos, exibindo a distribuição dos placares apostados por fase com contagem vs. limite, expansão por jogo e edição inline.

**Architecture:** Zero novos endpoints de API — o `GET /apostas` já retorna apostas com jogo embutido. O `FiltroJogo` ganha o valor `'Placares'`; quando ativo, a `JogosPage` substitui a lista de jogos pelo componente `PlacaresDist`, que agrupa apostas por fase e por placar. A edição reutiliza o `ApostaDrawer` já existente via `setJogoSelecionado` no pai.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, Jest + Testing Library

---

## Mapeamento de arquivos

| Arquivo | Ação |
|---|---|
| `apps/frontend/src/lib/jogoEstado.ts` | Modificar — adiciona `'Placares'` ao tipo `FiltroJogo` e ao switch de `jogoNoFiltro` |
| `apps/frontend/src/__tests__/jogoEstado.test.ts` | Modificar — testa o novo valor no switch |
| `apps/frontend/src/components/FiltroJogosChips.tsx` | Modificar — adiciona chip "Meus Placares" ao array e ao record de labels |
| `apps/frontend/src/__tests__/FiltroJogosChips.test.tsx` | Modificar — atualiza contagem e cobre clique no novo chip |
| `apps/frontend/src/components/PlacaresDist.tsx` | Criar — componente principal + `PlacarDistRow` inline |
| `apps/frontend/src/__tests__/PlacaresDist.test.tsx` | Criar — testes do componente |
| `apps/frontend/src/app/(app)/jogos/page.tsx` | Modificar — renderiza `PlacaresDist` quando `filtro === 'Placares'` |

---

## Task 1: Estender FiltroJogo com 'Placares'

**Files:**
- Modify: `apps/frontend/src/lib/jogoEstado.ts`
- Modify: `apps/frontend/src/__tests__/jogoEstado.test.ts`

- [ ] **Step 1: Adicionar o teste que falha**

Abrir `apps/frontend/src/__tests__/jogoEstado.test.ts` e acrescentar no final:

```ts
it('filtro Placares retorna false para qualquer estado', () => {
  expect(jogoNoFiltro('aberto',      'Placares')).toBe(false);
  expect(jogoNoFiltro('salvo',       'Placares')).toBe(false);
  expect(jogoNoFiltro('aguardando',  'Placares')).toBe(false);
  expect(jogoNoFiltro('finalizado',  'Placares')).toBe(false);
  expect(jogoNoFiltro('sem-palpite', 'Placares')).toBe(false);
});
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

```bash
pnpm --filter frontend test -- jogoEstado
```

Esperado: erro de tipo TypeScript ou falha de runtime — `'Placares'` não pertence ao tipo e o switch não cobre o caso.

- [ ] **Step 3: Atualizar `jogoEstado.ts`**

No arquivo `apps/frontend/src/lib/jogoEstado.ts`, fazer as duas mudanças:

```ts
// Linha 7 — antes:
export type FiltroJogo = 'Todos' | 'Pendentes' | 'Apostados' | 'Encerrados';

// Depois:
export type FiltroJogo = 'Todos' | 'Pendentes' | 'Apostados' | 'Encerrados' | 'Placares';
```

```ts
// Função jogoNoFiltro — antes:
export function jogoNoFiltro(estado: EstadoAposta, filtro: FiltroJogo): boolean {
  switch (filtro) {
    case 'Todos':      return true;
    case 'Pendentes':  return estado === 'aberto';
    case 'Apostados':  return estado === 'salvo';
    case 'Encerrados': return estado === 'aguardando' || estado === 'finalizado' || estado === 'sem-palpite';
  }
}

// Depois (adiciona case 'Placares'):
export function jogoNoFiltro(estado: EstadoAposta, filtro: FiltroJogo): boolean {
  switch (filtro) {
    case 'Todos':      return true;
    case 'Pendentes':  return estado === 'aberto';
    case 'Apostados':  return estado === 'salvo';
    case 'Encerrados': return estado === 'aguardando' || estado === 'finalizado' || estado === 'sem-palpite';
    case 'Placares':   return false;
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
pnpm --filter frontend test -- jogoEstado
```

Esperado: todos os testes PASS, inclusive o novo.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/lib/jogoEstado.ts apps/frontend/src/__tests__/jogoEstado.test.ts
git commit -m "feat: adiciona filtro Placares ao tipo FiltroJogo"
```

---

## Task 2: Adicionar chip "Meus Placares" ao FiltroJogosChips

**Files:**
- Modify: `apps/frontend/src/components/FiltroJogosChips.tsx`
- Modify: `apps/frontend/src/__tests__/FiltroJogosChips.test.tsx`

- [ ] **Step 1: Atualizar os testes existentes e adicionar um novo**

Substituir o conteúdo de `apps/frontend/src/__tests__/FiltroJogosChips.test.tsx` por:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { FiltroJogosChips } from '@/components/FiltroJogosChips';

it('renderiza os 5 filtros com rótulos legíveis', () => {
  render(<FiltroJogosChips selecionada="Todos" onChange={jest.fn()} />);
  expect(screen.getByText('Todos')).toBeInTheDocument();
  expect(screen.getByText('Pendentes de aposta')).toBeInTheDocument();
  expect(screen.getByText('Apostados')).toBeInTheDocument();
  expect(screen.getByText('Encerrados')).toBeInTheDocument();
  expect(screen.getByText('Meus Placares')).toBeInTheDocument();
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

it('clique em Meus Placares chama onChange com Placares', () => {
  const onChange = jest.fn();
  render(<FiltroJogosChips selecionada="Todos" onChange={onChange} />);
  fireEvent.click(screen.getByText('Meus Placares'));
  expect(onChange).toHaveBeenCalledWith('Placares');
});
```

- [ ] **Step 2: Rodar os testes e confirmar falha**

```bash
pnpm --filter frontend test -- FiltroJogosChips
```

Esperado: falha — "Meus Placares" não existe ainda no componente.

- [ ] **Step 3: Atualizar `FiltroJogosChips.tsx`**

Substituir o conteúdo de `apps/frontend/src/components/FiltroJogosChips.tsx` por:

```tsx
import type { FiltroJogo } from '@/lib/jogoEstado';

const FILTROS: FiltroJogo[] = ['Todos', 'Pendentes', 'Apostados', 'Encerrados', 'Placares'];

const FILTRO_LABELS: Record<FiltroJogo, string> = {
  Todos: 'Todos',
  Pendentes: 'Pendentes de aposta',
  Apostados: 'Apostados',
  Encerrados: 'Encerrados',
  Placares: 'Meus Placares',
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

```bash
pnpm --filter frontend test -- FiltroJogosChips
```

Esperado: todos os testes PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/FiltroJogosChips.tsx apps/frontend/src/__tests__/FiltroJogosChips.test.tsx
git commit -m "feat: adiciona chip Meus Placares ao FiltroJogosChips"
```

---

## Task 3: Criar o componente PlacaresDist

**Files:**
- Create: `apps/frontend/src/components/PlacaresDist.tsx`
- Create: `apps/frontend/src/__tests__/PlacaresDist.test.tsx`

- [ ] **Step 1: Criar o arquivo de testes**

Criar `apps/frontend/src/__tests__/PlacaresDist.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PlacaresDist } from '@/components/PlacaresDist';
import type { Aposta, Jogo } from '@/types/api';

const selecao = (nome: string) => ({
  id: nome, nome, codigo: nome.slice(0, 3).toUpperCase(), bandeiraSvg: '<svg></svg>',
});

const HORA_FUTURA  = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
const HORA_PASSADA = new Date(Date.now() - 2 * 3600 * 1000).toISOString();

function makeJogo(overrides: Partial<Jogo> = {}): Jogo {
  return {
    id: 'j1', dataHora: HORA_FUTURA, rodada: 1, grupo: null, fase: 'GRUPOS',
    placarCasa: null, placarVisitante: null, pesoPontuacao: 1,
    selecaoCasa: selecao('Brasil'), selecaoVisitante: selecao('Argentina'),
    ...overrides,
  };
}

function makeAposta(overrides: Partial<Aposta> = {}): Aposta {
  return {
    id: 'a1', jogoId: 'j1', placarCasa: 1, placarVisitante: 0,
    pontuacao: null, atualizadoEm: new Date().toISOString(),
    jogo: makeJogo(),
    ...overrides,
  };
}

it('mostra EmptyState quando não há apostas em grupos', () => {
  render(<PlacaresDist apostas={[]} onApostar={jest.fn()} />);
  expect(screen.getAllByText(/nenhum palpite/i).length).toBeGreaterThan(0);
});

it('exibe seções Fase de Grupos e Fases Eliminatórias', () => {
  render(<PlacaresDist apostas={[]} onApostar={jest.fn()} />);
  expect(screen.getByText('Fase de Grupos')).toBeInTheDocument();
  expect(screen.getByText('Fases Eliminatórias')).toBeInTheDocument();
});

it('exibe o limite correto de cada fase', () => {
  render(<PlacaresDist apostas={[]} onApostar={jest.fn()} />);
  expect(screen.getByText(/limite: 18 apostas idênticas/i)).toBeInTheDocument();
  expect(screen.getByText(/limite: 8 apostas idênticas/i)).toBeInTheDocument();
});

it('aposta de GRUPOS aparece na seção de Grupos', () => {
  const aposta = makeAposta({ id: 'a1', placarCasa: 2, placarVisitante: 0 });
  render(<PlacaresDist apostas={[aposta]} onApostar={jest.fn()} />);
  expect(screen.getByText('2 × 0')).toBeInTheDocument();
  expect(screen.getByText('1/18')).toBeInTheDocument();
});

it('aposta de OITAVAS aparece na seção Eliminatórias', () => {
  const aposta = makeAposta({
    id: 'a2', placarCasa: 1, placarVisitante: 1,
    jogo: makeJogo({ fase: 'OITAVAS' }),
  });
  render(<PlacaresDist apostas={[aposta]} onApostar={jest.fn()} />);
  expect(screen.getByText('1 × 1')).toBeInTheDocument();
  expect(screen.getByText('1/8')).toBeInTheDocument();
});

it('duas apostas com mesmo placar agrupam e mostram contagem 2', () => {
  const a1 = makeAposta({ id: 'a1', jogoId: 'j1', jogo: makeJogo({ id: 'j1' }) });
  const a2 = makeAposta({ id: 'a2', jogoId: 'j2', jogo: makeJogo({ id: 'j2' }) });
  render(<PlacaresDist apostas={[a1, a2]} onApostar={jest.fn()} />);
  expect(screen.getByText('2/18')).toBeInTheDocument();
});

it('expande ao clicar no row e exibe os times', () => {
  const aposta = makeAposta();
  render(<PlacaresDist apostas={[aposta]} onApostar={jest.fn()} />);
  fireEvent.click(screen.getByText('1 × 0'));
  expect(screen.getByText('BRA')).toBeInTheDocument();
  expect(screen.getByText('ARG')).toBeInTheDocument();
});

it('aposta aberta exibe botão Editar', () => {
  const aposta = makeAposta({ jogo: makeJogo({ dataHora: HORA_FUTURA }) });
  render(<PlacaresDist apostas={[aposta]} onApostar={jest.fn()} />);
  fireEvent.click(screen.getByText('1 × 0'));
  expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
});

it('clicar em Editar chama onApostar com o jogo correto', () => {
  const onApostar = jest.fn();
  const jogo = makeJogo({ id: 'jX', dataHora: HORA_FUTURA });
  const aposta = makeAposta({ jogo });
  render(<PlacaresDist apostas={[aposta]} onApostar={onApostar} />);
  fireEvent.click(screen.getByText('1 × 0'));
  fireEvent.click(screen.getByRole('button', { name: /editar/i }));
  expect(onApostar).toHaveBeenCalledWith(jogo);
});

it('aposta encerrada com pontuacao exibe "+N pts"', () => {
  const aposta = makeAposta({
    pontuacao: 15,
    jogo: makeJogo({ dataHora: HORA_PASSADA }),
  });
  render(<PlacaresDist apostas={[aposta]} onApostar={jest.fn()} />);
  fireEvent.click(screen.getByText('1 × 0'));
  expect(screen.getByText('+15 pts')).toBeInTheDocument();
});

it('aposta encerrada sem pontuacao exibe "Aguardando"', () => {
  const aposta = makeAposta({
    pontuacao: null,
    jogo: makeJogo({ dataHora: HORA_PASSADA }),
  });
  render(<PlacaresDist apostas={[aposta]} onApostar={jest.fn()} />);
  fireEvent.click(screen.getByText('1 × 0'));
  expect(screen.getByText('Aguardando')).toBeInTheDocument();
});

it('placar mais frequente aparece antes', () => {
  const maisFreq = [
    makeAposta({ id: 'a1', jogoId: 'j1', placarCasa: 2, placarVisitante: 0, jogo: makeJogo({ id: 'j1' }) }),
    makeAposta({ id: 'a2', jogoId: 'j2', placarCasa: 2, placarVisitante: 0, jogo: makeJogo({ id: 'j2' }) }),
  ];
  const menosFreq = makeAposta({ id: 'a3', jogoId: 'j3', placarCasa: 1, placarVisitante: 1, jogo: makeJogo({ id: 'j3' }) });
  const { container } = render(<PlacaresDist apostas={[...maisFreq, menosFreq]} onApostar={jest.fn()} />);
  const rowButtons = container.querySelectorAll('button');
  expect(rowButtons[0].textContent).toContain('2 × 0');
  expect(rowButtons[1].textContent).toContain('1 × 1');
});
```

- [ ] **Step 2: Rodar os testes e confirmar falha**

```bash
pnpm --filter frontend test -- PlacaresDist
```

Esperado: falha — módulo `@/components/PlacaresDist` não existe.

- [ ] **Step 3: Criar `PlacaresDist.tsx`**

Criar `apps/frontend/src/components/PlacaresDist.tsx`:

```tsx
'use client';

import { useState } from 'react';
import {
  FASES_ELIMINATORIAS,
  MAX_APOSTAS_IGUAIS_GRUPOS,
  MAX_APOSTAS_IGUAIS_ELIMINATORIAS,
  JogoFase,
} from '@bolao/shared';
import type { Aposta, Jogo } from '@/types/api';
import { prazoEncerrado } from '@/lib/jogoEstado';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';
import { EmptyState } from '@/components/EmptyState';

interface PlacasDistProps {
  apostas: Aposta[];
  onApostar: (jogo: Jogo) => void;
}

type PlacarGrupo = {
  placarCasa: number;
  placarVisitante: number;
  apostas: Aposta[];
};

function agruparPorPlacar(apostas: Aposta[]): PlacarGrupo[] {
  const map = new Map<string, Aposta[]>();
  for (const a of apostas) {
    const key = `${a.placarCasa}-${a.placarVisitante}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  return Array.from(map.values())
    .map(lista => ({
      placarCasa: lista[0].placarCasa,
      placarVisitante: lista[0].placarVisitante,
      apostas: lista,
    }))
    .sort((a, b) => b.apostas.length - a.apostas.length);
}

function barraColor(count: number, limite: number): string {
  const pct = count / limite;
  if (pct >= 1)    return 'bg-red-500';
  if (pct >= 0.75) return 'bg-trovao-gold';
  return 'bg-gray-600';
}

interface PlacarDistRowProps {
  grupo: PlacarGrupo;
  limite: number;
  onApostar: (jogo: Jogo) => void;
}

function PlacarDistRow({ grupo, limite, onApostar }: PlacarDistRowProps) {
  const [expandido, setExpandido] = useState(false);
  const count = grupo.apostas.length;
  const pct   = Math.min((count / limite) * 100, 100);

  return (
    <div className="border border-trovao-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpandido(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-trovao-surface/50 transition-colors"
      >
        <span className="text-white font-bold tabular-nums w-14 text-left shrink-0">
          {grupo.placarCasa} × {grupo.placarVisitante}
        </span>
        <div className="flex-1 h-2 bg-trovao-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barraColor(count, limite)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-trovao-muted text-xs tabular-nums w-10 text-right shrink-0">
          {count}/{limite}
        </span>
        <span className="text-trovao-muted text-xs shrink-0">
          {expandido ? '˄' : '˅'}
        </span>
      </button>

      {expandido && (
        <div className="divide-y divide-trovao-border">
          {grupo.apostas.map(aposta => {
            const aberto = !prazoEncerrado(aposta.jogo);
            return (
              <div key={aposta.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex items-center gap-1.5 shrink-0">
                  <SelecaoAvatar
                    nome={aposta.jogo.selecaoCasa.nome}
                    bandeiraSvg={aposta.jogo.selecaoCasa.bandeiraSvg}
                    size="sm"
                  />
                  <span className="text-xs text-trovao-muted">{aposta.jogo.selecaoCasa.codigo}</span>
                  <span className="text-xs text-trovao-muted">×</span>
                  <span className="text-xs text-trovao-muted">{aposta.jogo.selecaoVisitante.codigo}</span>
                  <SelecaoAvatar
                    nome={aposta.jogo.selecaoVisitante.nome}
                    bandeiraSvg={aposta.jogo.selecaoVisitante.bandeiraSvg}
                    size="sm"
                  />
                </div>
                <span className="text-xs text-trovao-muted flex-1 min-w-0 truncate">
                  {new Date(aposta.jogo.dataHora).toLocaleDateString('pt-BR', {
                    weekday: 'short', day: '2-digit', month: '2-digit',
                  })}
                  {' · '}
                  {new Date(aposta.jogo.dataHora).toLocaleTimeString('pt-BR', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
                <div className="text-xs shrink-0">
                  {aberto ? (
                    <button
                      onClick={() => onApostar(aposta.jogo)}
                      className="text-trovao-gold hover:underline font-semibold"
                    >
                      Editar
                    </button>
                  ) : aposta.pontuacao !== null ? (
                    <span className="text-white">+{aposta.pontuacao} pts</span>
                  ) : (
                    <span className="text-trovao-muted">Aguardando</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PlacaresDist({ apostas, onApostar }: PlacasDistProps) {
  const apostasGrupos = apostas.filter(
    a => !FASES_ELIMINATORIAS.includes(a.jogo.fase as JogoFase),
  );
  const apostasElim = apostas.filter(
    a => FASES_ELIMINATORIAS.includes(a.jogo.fase as JogoFase),
  );

  const gruposDistribuicao = agruparPorPlacar(apostasGrupos);
  const elimDistribuicao   = agruparPorPlacar(apostasElim);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-white">Fase de Grupos</h2>
          <span className="text-xs text-trovao-muted">
            limite: {MAX_APOSTAS_IGUAIS_GRUPOS} apostas idênticas
          </span>
        </div>
        {gruposDistribuicao.length === 0 ? (
          <EmptyState
            titulo="Nenhum palpite"
            descricao="Nenhum palpite na fase de grupos ainda."
          />
        ) : (
          <div className="space-y-2">
            {gruposDistribuicao.map(g => (
              <PlacarDistRow
                key={`${g.placarCasa}-${g.placarVisitante}`}
                grupo={g}
                limite={MAX_APOSTAS_IGUAIS_GRUPOS}
                onApostar={onApostar}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-white">Fases Eliminatórias</h2>
          <span className="text-xs text-trovao-muted">
            limite: {MAX_APOSTAS_IGUAIS_ELIMINATORIAS} apostas idênticas
          </span>
        </div>
        {elimDistribuicao.length === 0 ? (
          <EmptyState
            titulo="Nenhum palpite"
            descricao="Nenhum palpite nas fases eliminatórias ainda."
          />
        ) : (
          <div className="space-y-2">
            {elimDistribuicao.map(g => (
              <PlacarDistRow
                key={`${g.placarCasa}-${g.placarVisitante}`}
                grupo={g}
                limite={MAX_APOSTAS_IGUAIS_ELIMINATORIAS}
                onApostar={onApostar}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
pnpm --filter frontend test -- PlacaresDist
```

Esperado: todos os testes PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/PlacaresDist.tsx apps/frontend/src/__tests__/PlacaresDist.test.tsx
git commit -m "feat: componente PlacaresDist com distribuição de placares por fase"
```

---

## Task 4: Integrar PlacaresDist na JogosPage

**Files:**
- Modify: `apps/frontend/src/app/(app)/jogos/page.tsx`

- [ ] **Step 1: Adicionar o import de PlacaresDist no topo do arquivo**

No arquivo `apps/frontend/src/app/(app)/jogos/page.tsx`, adicionar após os imports existentes:

```tsx
import { PlacaresDist } from '@/components/PlacaresDist';
```

- [ ] **Step 2: Substituir o bloco condicional de renderização**

Localizar o bloco atual (a partir da linha com `{loading ? (`):

```tsx
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
```

Substituir por:

```tsx
      {loading ? (
        <PageSkeleton />
      ) : filtro === 'Placares' ? (
        <PlacaresDist
          apostas={[...apostas.values()]}
          onApostar={setJogoSelecionado}
        />
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
```

- [ ] **Step 3: Rodar a suite completa de testes**

```bash
pnpm --filter frontend test
```

Esperado: todos os testes PASS, sem erros de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/app/(app)/jogos/page.tsx
git commit -m "feat: renderiza PlacaresDist quando filtro Placares está ativo"
```

---

## Verificação manual

Após as 4 tasks, conferir no dev server (`pnpm --filter frontend dev`):

1. A página de Jogos tem o chip "Meus Placares" no scroll horizontal de filtros
2. Clicar em "Meus Placares" substitui a lista de jogos pela view de distribuição
3. Apostas de fase GRUPOS aparecem na seção "Fase de Grupos" com limite 18
4. Apostas de fases eliminatórias aparecem na seção "Fases Eliminatórias" com limite 8
5. Clicar em um placar expande a lista de jogos com aquele placar
6. Jogos ainda abertos mostram botão "Editar" que abre o ApostaDrawer
7. Após editar e salvar, a distribuição atualiza sem recarregar a página
8. Jogos encerrados com resultado mostram "+N pts"
9. Jogos encerrados sem resultado mostram "Aguardando"
10. Voltar a qualquer outro filtro (Pendentes, etc.) mostra a lista normalmente
