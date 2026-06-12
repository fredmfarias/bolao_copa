# Ranking Geral — palpites do usuário no accordion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No accordion do ranking **Geral**, exibir a quantidade de apostas realizadas por usuário e um link para uma tela dedicada com todos os palpites do usuário em rodadas publicadas, restritos a jogos com apostas encerradas.

**Architecture:** Backend ganha um endpoint que agrupa palpites por publicação, reaproveitando um helper extraído de `palpitesDaRodada` que agora filtra cada jogo por prazo encerrado (correção de segurança). Frontend acrescenta contagem + link no `RankingRow` (modo geral), um componente de apresentação `UsuarioPalpitesRodadas` e uma nova rota que os consome.

**Tech Stack:** NestJS + Prisma (backend), Next.js (App Router) + React + Tailwind (frontend), Jest + Testing Library.

---

## Arquivos

**Backend**
- Modify: `apps/backend/src/ranking/ranking.service.ts` — extrair helper `montarPalpitesDaPublicacao` (com filtro de prazo) e adicionar `palpitesDoUsuario`.
- Modify: `apps/backend/src/ranking/ranking.controller.ts` — nova rota `GET usuarios/:usuarioId/apostas`.
- Test: `apps/backend/src/ranking/ranking.service.spec.ts`.

**Frontend**
- Modify: `apps/frontend/src/types/api.ts` — novo tipo `UsuarioPalpitesRodada`.
- Modify: `apps/frontend/src/components/RankingRow.tsx` — contagem + link no modo geral.
- Test: `apps/frontend/src/__tests__/RankingRow.test.tsx`.
- Create: `apps/frontend/src/components/UsuarioPalpitesRodadas.tsx` — apresentação das seções por rodada.
- Test: `apps/frontend/src/__tests__/UsuarioPalpitesRodadas.test.tsx`.
- Create: `apps/frontend/src/app/(app)/ranking/[bolaoId]/usuarios/[usuarioId]/palpites/page.tsx` — nova tela.

**Docs**
- Modify: `README.md` — regra de visibilidade e descrição do modo Geral.

---

## Task 1: Backend — extrair helper com filtro de prazo

Refatora `palpitesDaRodada` para usar um helper privado que filtra jogos cujas apostas ainda não encerraram. Isso fecha a lacuna de segurança (publicação não garante prazo encerrado).

**Files:**
- Modify: `apps/backend/src/ranking/ranking.service.ts`
- Test: `apps/backend/src/ranking/ranking.service.spec.ts`

- [ ] **Step 1: Escrever o teste que falha (filtro de prazo)**

Adicionar este teste dentro do `describe('palpitesDaRodada', ...)` em `apps/backend/src/ranking/ranking.service.spec.ts`:

```ts
it('omite jogos cujas apostas ainda não encerraram (prazo não atingido)', async () => {
  prismaMock.publicacao.findUnique.mockResolvedValue({ id: 'pub-3', numero: 3 });
  prismaMock.jogo.findMany.mockResolvedValue([
    {
      id: 'j1', dataHora: new Date('2026-06-11T16:00:00Z'), // passado → visível
      pesoPontuacao: 1, placarCasa: 1, placarVisitante: 0,
      selecaoCasa:      { nome: 'Brasil',    codigo: 'BRA', bandeiraSvg: '<svg></svg>' },
      selecaoVisitante: { nome: 'Argentina', codigo: 'ARG', bandeiraSvg: '<svg></svg>' },
    },
    {
      id: 'j2', dataHora: new Date('2099-01-01T00:00:00Z'), // futuro → oculto
      pesoPontuacao: 1, placarCasa: 0, placarVisitante: 0,
      selecaoCasa:      { nome: 'Espanha',  codigo: 'ESP', bandeiraSvg: '<svg></svg>' },
      selecaoVisitante: { nome: 'Portugal', codigo: 'POR', bandeiraSvg: '<svg></svg>' },
    },
  ]);
  prismaMock.aposta.findMany.mockResolvedValue([]);

  const r = await service.palpitesDaRodada('b1', 3, 'u1');

  expect(r).toHaveLength(1);
  expect(r[0].jogo.id).toBe('j1');
  expect(prismaMock.aposta.findMany).toHaveBeenCalledWith({
    where: { usuarioId: 'u1', jogoId: { in: ['j1'] } },
    select: { jogoId: true, placarCasa: true, placarVisitante: true, pontuacao: true },
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `pnpm --filter @bolao/backend test -- ranking.service`
Expected: FAIL — hoje `palpitesDaRodada` retorna os 2 jogos e chama `aposta.findMany` com `['j1','j2']`.

- [ ] **Step 3: Implementar o helper e refatorar `palpitesDaRodada`**

Em `apps/backend/src/ranking/ranking.service.ts`, adicionar o import do prazo no topo (junto aos demais imports):

```ts
import { MINUTOS_PRAZO_APOSTA } from '@bolao/shared';
```

Substituir o método `palpitesDaRodada` atual (linhas ~94-125) por:

```ts
async palpitesDaRodada(bolaoId: string, numero: number, usuarioId: string) {
  // bolaoId é mantido para autorização futura/symmetry; visibilidade segue padrão das apostas.
  const publicacao = await this.prisma.publicacao.findUnique({ where: { numero } });
  if (!publicacao) return [];
  return this.montarPalpitesDaPublicacao(publicacao.id, usuarioId);
}

private async montarPalpitesDaPublicacao(publicacaoId: string, usuarioId: string) {
  const jogos = await this.prisma.jogo.findMany({
    where: { publicacaoId },
    orderBy: { dataHora: 'asc' },
    select: {
      id: true, dataHora: true, pesoPontuacao: true,
      placarCasa: true, placarVisitante: true,
      selecaoCasa:      { select: { nome: true, codigo: true, bandeiraSvg: true } },
      selecaoVisitante: { select: { nome: true, codigo: true, bandeiraSvg: true } },
    },
  });

  // Segurança: só revela palpites de jogos cujas apostas já encerraram,
  // mesmo regra de listarPalpitesPorJogo — publicação sozinha não garante prazo.
  const agora = Date.now();
  const visiveis = jogos.filter(
    (j) => agora >= j.dataHora.getTime() - MINUTOS_PRAZO_APOSTA * 60 * 1000,
  );
  if (visiveis.length === 0) return [];

  const apostas = await this.prisma.aposta.findMany({
    where: { usuarioId, jogoId: { in: visiveis.map((j) => j.id) } },
    select: { jogoId: true, placarCasa: true, placarVisitante: true, pontuacao: true },
  });
  const apostaPorJogo = new Map(apostas.map((a) => [a.jogoId, a]));

  return visiveis.map((jogo) => {
    const a = apostaPorJogo.get(jogo.id);
    return {
      jogo,
      palpite: a ? { placarCasa: a.placarCasa, placarVisitante: a.placarVisitante } : null,
      pontuacao: a?.pontuacao ?? 0,
    };
  });
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `pnpm --filter @bolao/backend test -- ranking.service`
Expected: PASS — o novo teste e os testes existentes de `palpitesDaRodada` (jogos passados continuam visíveis).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/ranking/ranking.service.ts apps/backend/src/ranking/ranking.service.spec.ts
git commit -m "refactor(ranking): filtra palpites por prazo encerrado via helper"
```

---

## Task 2: Backend — endpoint `palpitesDoUsuario`

Agrega os palpites do usuário por publicação (rodadas publicadas do bolão), reusando o helper da Task 1.

**Files:**
- Modify: `apps/backend/src/ranking/ranking.service.ts`
- Modify: `apps/backend/src/ranking/ranking.controller.ts`
- Test: `apps/backend/src/ranking/ranking.service.spec.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar este `describe` em `apps/backend/src/ranking/ranking.service.spec.ts`, dentro do bloco `describe('RankingService leitura de snapshot', ...)` (que já tem `prismaMock` com `rankingSnapshot`, `jogo` e `aposta`):

```ts
describe('palpitesDoUsuario', () => {
  it('agrupa por publicação e omite rodadas sem jogos visíveis', async () => {
    prismaMock.rankingSnapshot.findMany.mockResolvedValue([
      { publicacao: { id: 'pub-2', numero: 2, publicadoEm: new Date('2026-05-26') } },
      { publicacao: { id: 'pub-1', numero: 1, publicadoEm: new Date('2026-05-25') } },
    ]);
    // pub-2 tem um jogo passado; pub-1 não tem jogos
    prismaMock.jogo.findMany
      .mockResolvedValueOnce([
        {
          id: 'j1', dataHora: new Date('2026-05-25T16:00:00Z'),
          pesoPontuacao: 1, placarCasa: 2, placarVisitante: 1,
          selecaoCasa:      { nome: 'Brasil',    codigo: 'BRA', bandeiraSvg: '<svg></svg>' },
          selecaoVisitante: { nome: 'Argentina', codigo: 'ARG', bandeiraSvg: '<svg></svg>' },
        },
      ])
      .mockResolvedValueOnce([]);
    prismaMock.aposta.findMany.mockResolvedValue([
      { jogoId: 'j1', placarCasa: 2, placarVisitante: 1, pontuacao: 6 },
    ]);

    const r = await service.palpitesDoUsuario('b1', 'u1');

    expect(prismaMock.rankingSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bolaoId: 'b1' },
        distinct: ['publicacaoId'],
      }),
    );
    expect(r).toEqual([
      {
        publicacao: { numero: 2, publicadoEm: new Date('2026-05-26') },
        items: [
          {
            jogo: expect.objectContaining({ id: 'j1' }),
            palpite: { placarCasa: 2, placarVisitante: 1 },
            pontuacao: 6,
          },
        ],
      },
    ]);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `pnpm --filter @bolao/backend test -- ranking.service`
Expected: FAIL — `service.palpitesDoUsuario is not a function`.

- [ ] **Step 3: Implementar `palpitesDoUsuario`**

Em `apps/backend/src/ranking/ranking.service.ts`, adicionar o método logo após `palpitesDaRodada`:

```ts
async palpitesDoUsuario(bolaoId: string, usuarioId: string) {
  const snapshots = await this.prisma.rankingSnapshot.findMany({
    where: { bolaoId },
    distinct: ['publicacaoId'],
    include: { publicacao: { select: { id: true, numero: true, publicadoEm: true } } },
    orderBy: { publicacao: { numero: 'desc' } },
  });

  const grupos = [];
  for (const s of snapshots) {
    const items = await this.montarPalpitesDaPublicacao(s.publicacao.id, usuarioId);
    if (items.length === 0) continue;
    grupos.push({
      publicacao: { numero: s.publicacao.numero, publicadoEm: s.publicacao.publicadoEm },
      items,
    });
  }
  return grupos;
}
```

- [ ] **Step 4: Adicionar a rota no controller**

Em `apps/backend/src/ranking/ranking.controller.ts`, adicionar após `palpitesDaRodada`:

```ts
@Get('usuarios/:usuarioId/apostas')
palpitesDoUsuario(
  @Param('bolaoId') bolaoId: string,
  @Param('usuarioId') usuarioId: string,
) {
  return this.service.palpitesDoUsuario(bolaoId, usuarioId);
}
```

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `pnpm --filter @bolao/backend test -- ranking.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/ranking/ranking.service.ts apps/backend/src/ranking/ranking.controller.ts apps/backend/src/ranking/ranking.service.spec.ts
git commit -m "feat(ranking): endpoint de palpites do usuário por publicação"
```

---

## Task 3: Frontend — tipo `UsuarioPalpitesRodada`

**Files:**
- Modify: `apps/frontend/src/types/api.ts`

- [ ] **Step 1: Adicionar o tipo**

No fim de `apps/frontend/src/types/api.ts`, após `RodadaPalpiteItem`, adicionar:

```ts
export interface UsuarioPalpitesRodada {
  publicacao: { numero: number; publicadoEm: string };
  items: RodadaPalpiteItem[];
}
```

- [ ] **Step 2: Verificar tipos**

Run: `pnpm --filter @bolao/frontend exec tsc --noEmit`
Expected: PASS (sem erros).

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/types/api.ts
git commit -m "types: UsuarioPalpitesRodada"
```

---

## Task 4: Frontend — contagem + link no `RankingRow` (modo geral)

**Files:**
- Modify: `apps/frontend/src/components/RankingRow.tsx`
- Test: `apps/frontend/src/__tests__/RankingRow.test.tsx`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar em `apps/frontend/src/__tests__/RankingRow.test.tsx` (o `entry` de teste já tem `apostasPostadas: 11`):

```ts
it('exibe a quantidade de apostas realizadas ao expandir no modo geral', () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText(/Apostas realizadas:/)).toBeInTheDocument();
  expect(screen.getByText('11')).toBeInTheDocument();
});

it('exibe link para os palpites do usuário no modo geral', () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button'));
  const link = screen.getByRole('link', { name: /ver palpites/i });
  expect(link).toHaveAttribute('href', '/ranking/b1/usuarios/u1/palpites');
});

it('não exibe o link de palpites no modo rodada', () => {
  render(<RankingRow entry={entry} bolaoId="b1" posicaoRodada={1} publicacaoNumero={3} />);
  fireEvent.click(screen.getByRole('button'));
  expect(screen.queryByRole('link', { name: /ver palpites/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @bolao/frontend test -- RankingRow`
Expected: FAIL — texto/link ainda não existem.

- [ ] **Step 3: Implementar no `RankingRow`**

Em `apps/frontend/src/components/RankingRow.tsx`, adicionar o import no topo (após os imports existentes):

```ts
import Link from 'next/link';
```

No bloco do modo geral (o ramo `) : (` do JSX, que hoje contém o grid de acertos e o gráfico de evolução), adicionar logo após o bloco do `RankingEvolucao` e antes de fechar o fragmento `</>`:

```tsx
<div className="flex items-center justify-between pt-1">
  <span className="text-trovao-muted text-xs">
    Apostas realizadas:{' '}
    <span className="text-white font-semibold tabular-nums">{entry.apostasPostadas}</span>
  </span>
  <Link
    href={`/ranking/${bolaoId}/usuarios/${entry.usuarioId}/palpites`}
    className="text-trovao-gold text-xs font-medium hover:underline"
  >
    Ver palpites →
  </Link>
</div>
```

Para referência, o ramo geral fica assim:

```tsx
) : (
  <>
    <div className="grid grid-cols-2 gap-2">
      {ACERTOS.map(({ label, key }) => (
        <div key={key} className="flex justify-between text-xs">
          <span className="text-trovao-muted">{label}</span>
          <span className="text-white font-semibold tabular-nums">{entry[key]}</span>
        </div>
      ))}
    </div>
    {loading && <p className="text-trovao-muted text-xs text-center py-2">Carregando evolução...</p>}
    {!loading && evolucao && evolucao.length > 0 && <RankingEvolucao dados={evolucao} />}
    <div className="flex items-center justify-between pt-1">
      <span className="text-trovao-muted text-xs">
        Apostas realizadas:{' '}
        <span className="text-white font-semibold tabular-nums">{entry.apostasPostadas}</span>
      </span>
      <Link
        href={`/ranking/${bolaoId}/usuarios/${entry.usuarioId}/palpites`}
        className="text-trovao-gold text-xs font-medium hover:underline"
      >
        Ver palpites →
      </Link>
    </div>
  </>
)}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @bolao/frontend test -- RankingRow`
Expected: PASS (novos testes e os existentes).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/RankingRow.tsx apps/frontend/src/__tests__/RankingRow.test.tsx
git commit -m "feat(ranking): contagem de apostas e link de palpites no accordion geral"
```

---

## Task 5: Frontend — componente `UsuarioPalpitesRodadas`

**Files:**
- Create: `apps/frontend/src/components/UsuarioPalpitesRodadas.tsx`
- Test: `apps/frontend/src/__tests__/UsuarioPalpitesRodadas.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/frontend/src/__tests__/UsuarioPalpitesRodadas.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { UsuarioPalpitesRodadas } from '@/components/UsuarioPalpitesRodadas';
import type { UsuarioPalpitesRodada } from '@/types/api';

const grupos: UsuarioPalpitesRodada[] = [
  {
    publicacao: { numero: 2, publicadoEm: '2026-05-26T12:00:00.000Z' },
    items: [
      {
        jogo: {
          id: 'j1', dataHora: '2026-05-25T16:00:00.000Z',
          pesoPontuacao: 1, placarCasa: 2, placarVisitante: 1,
          selecaoCasa:      { nome: 'Brasil',    codigo: 'BRA', bandeiraSvg: '<svg></svg>' },
          selecaoVisitante: { nome: 'Argentina', codigo: 'ARG', bandeiraSvg: '<svg></svg>' },
        },
        palpite: { placarCasa: 2, placarVisitante: 1 },
        pontuacao: 6,
      },
    ],
  },
];

it('renderiza uma seção por publicação com a data e os palpites', () => {
  render(<UsuarioPalpitesRodadas grupos={grupos} />);
  expect(screen.getByText('26/05/2026')).toBeInTheDocument();
  expect(screen.getByText('BRA')).toBeInTheDocument();
  expect(screen.getByText('+6 pts')).toBeInTheDocument();
});

it('mostra empty state quando não há grupos', () => {
  render(<UsuarioPalpitesRodadas grupos={[]} />);
  expect(screen.getByText(/nenhum palpite/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @bolao/frontend test -- UsuarioPalpitesRodadas`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o componente**

Criar `apps/frontend/src/components/UsuarioPalpitesRodadas.tsx`:

```tsx
import type { UsuarioPalpitesRodada } from '@/types/api';
import { RankingPalpitesRodada } from './RankingPalpitesRodada';
import { EmptyState } from './EmptyState';
import { formatDataPublicacao } from '@/lib/dataFormat';

interface Props {
  grupos: UsuarioPalpitesRodada[];
}

export function UsuarioPalpitesRodadas({ grupos }: Props) {
  if (grupos.length === 0) {
    return (
      <EmptyState
        titulo="Nenhum palpite"
        descricao="Este usuário ainda não tem palpites em rodadas publicadas."
      />
    );
  }
  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <section key={g.publicacao.numero} className="space-y-2">
          <h2 className="text-trovao-muted text-xs uppercase tracking-wider">
            {formatDataPublicacao(g.publicacao.publicadoEm)}
          </h2>
          <RankingPalpitesRodada items={g.items} />
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @bolao/frontend test -- UsuarioPalpitesRodadas`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/UsuarioPalpitesRodadas.tsx apps/frontend/src/__tests__/UsuarioPalpitesRodadas.test.tsx
git commit -m "feat(ranking): componente de palpites do usuário por rodada"
```

---

## Task 6: Frontend — nova tela dedicada

A página é fina (busca + cabeçalho) e delega a renderização ao componente testado na Task 5; segue o padrão das demais rotas do App Router (sem teste de página dedicado).

**Files:**
- Create: `apps/frontend/src/app/(app)/ranking/[bolaoId]/usuarios/[usuarioId]/palpites/page.tsx`

- [ ] **Step 1: Criar a página**

Criar `apps/frontend/src/app/(app)/ranking/[bolaoId]/usuarios/[usuarioId]/palpites/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageSkeleton } from '@/components/PageSkeleton';
import { UsuarioPalpitesRodadas } from '@/components/UsuarioPalpitesRodadas';
import type { RankingEntry, UsuarioPalpitesRodada } from '@/types/api';

export default function UsuarioPalpitesPage() {
  const { bolaoId, usuarioId } = useParams<{ bolaoId: string; usuarioId: string }>();
  const [nome, setNome] = useState('');
  const [grupos, setGrupos] = useState<UsuarioPalpitesRodada[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<RankingEntry[]>(`/boloes/${bolaoId}/ranking`).catch(() => [] as RankingEntry[]),
      api
        .get<UsuarioPalpitesRodada[]>(`/boloes/${bolaoId}/ranking/usuarios/${usuarioId}/apostas`)
        .catch(() => [] as UsuarioPalpitesRodada[]),
    ]).then(([ranking, gs]) => {
      const entry = ranking.find((r) => r.usuarioId === usuarioId);
      setNome(entry?.usuario.nome ?? '');
      setGrupos(gs);
      setLoading(false);
    });
  }, [bolaoId, usuarioId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Palpites</h1>
          {nome && <p className="text-gray-400 text-sm mt-0.5">{nome}</p>}
        </div>
        <Link href={`/ranking/${bolaoId}`} className="text-trovao-muted text-sm hover:text-white shrink-0">
          ← Voltar
        </Link>
      </div>

      {loading ? <PageSkeleton /> : <UsuarioPalpitesRodadas grupos={grupos} />}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos e build de testes**

Run: `pnpm --filter @bolao/frontend exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/frontend/src/app/(app)/ranking/[bolaoId]/usuarios/[usuarioId]/palpites/page.tsx"
git commit -m "feat(ranking): tela de palpites do usuário por rodada"
```

---

## Task 7: Docs — atualizar README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Atualizar a descrição do modo Geral**

Em `README.md`, na linha de **Ranking por publicação** (~linha 13), substituir o trecho:

```
dois modos: **Geral** (acumulado) e **Rodada**
```

por:

```
dois modos: **Geral** (acumulado; o expand mostra a quantidade de apostas realizadas e um link para todos os palpites do usuário em rodadas publicadas) e **Rodada**
```

- [ ] **Step 2: Documentar a regra de visibilidade por prazo**

Em `README.md`, na seção **Funcionalidades**, na linha de **Palpites revelados** (~linha 11), ao final da frase, antes de qualquer ponto final, acrescentar:

```
; a API só revela palpites de jogos cujas apostas já encerraram (mesma regra de prazo nas telas de jogo e de ranking)
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: atualiza README com palpites do usuário no ranking geral"
```

---

## Verificação final

- [ ] **Rodar a suíte completa**

Run: `pnpm test`
Expected: PASS em backend e frontend.

- [ ] **Verificação de tipos do frontend**

Run: `pnpm --filter @bolao/frontend exec tsc --noEmit`
Expected: PASS.

- [ ] **Conferência manual (opcional, dev server)**

Run: `pnpm dev` e, no ranking de um bolão com rodada publicada, expandir uma linha no modo **Geral**: deve aparecer "Apostas realizadas: N" e "Ver palpites →"; o link abre a tela com as seções por rodada.
