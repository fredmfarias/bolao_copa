# Página de Estatísticas do Bolão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página de estatísticas por bolão (20 estatísticas/curiosidades) com endpoint cacheado por publicação.

**Architecture:** Novo módulo NestJS `estatistica` expõe `GET /boloes/:bolaoId/estatisticas`. O service verifica membership, busca 4 datasets (membros ativos, snapshots, jogos publicados, apostas) e delega o cálculo a **funções puras** em `calculos/` (testáveis sem Prisma). Resultado é cacheado em memória por `bolaoId`, chaveado pelo id da última publicação. No frontend, página em `/boloes/[id]/estatisticas` com cards por seção.

**Tech Stack:** NestJS 10, Prisma 5, Next.js 14, Recharts, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-02-pagina-estatisticas-design.md`

**Branch:** trabalhar na branch já criada `feat/pagina-estatisticas`.

---

## File Structure

```
apps/backend/src/estatistica/
├── estatistica.module.ts        # wiring
├── estatistica.controller.ts    # rota GET, guards
├── estatistica.service.ts       # membership, fetch, cache, orquestração
├── estatistica.types.ts         # tipos do payload + inputs das calculadoras
├── estatistica.service.spec.ts  # testes de service (404/403/cache/temDados)
└── calculos/
    ├── util.ts                  # mediana, desvioPadrao, topEntries, incrementar
    ├── util.spec.ts
    ├── posicoes.ts              # itens 1–6 (função pura)
    ├── posicoes.spec.ts
    ├── recordes.ts              # itens 7–10
    ├── recordes.spec.ts
    ├── palpites.ts              # itens 11–16, 20
    ├── palpites.spec.ts
    ├── zebras.ts                # itens 17–19
    └── zebras.spec.ts

apps/frontend/src/
├── app/(app)/boloes/[id]/estatisticas/page.tsx
├── components/estatisticas/
│   ├── EstatisticaCard.tsx      # card genérico (linhas com usuários ou texto + valor)
│   ├── PlacaresChart.tsx        # barras horizontais (item 11)
│   └── AproveitamentoFases.tsx  # tabela (item 10)
├── types/api.ts                 # (modificar) tipos do payload
└── __tests__/
    ├── EstatisticaCard.test.tsx
    ├── PlacaresChart.test.tsx
    ├── AproveitamentoFases.test.tsx
    └── EstatisticasPage.test.tsx

e2e/tests/estatisticas/estatisticas.api.spec.ts
```

Comandos de teste usados neste plano (a partir da raiz do repo):

- Backend: `cd apps/backend; pnpm test -- --testPathPattern=estatistica`
- Frontend: `cd apps/frontend; pnpm test -- <NomeDoTeste>`
- Typecheck backend: `cd apps/backend; pnpm exec tsc --noEmit`
- E2E: `cd e2e; npx playwright test tests/estatisticas/estatisticas.api.spec.ts --project=api` (exige `pnpm dev:infra` no ar e o banco `bolao_trovao_e2e` criado — ver README)

---

### Task 1: Tipos e utilitários de cálculo

**Files:**
- Create: `apps/backend/src/estatistica/estatistica.types.ts`
- Create: `apps/backend/src/estatistica/calculos/util.ts`
- Test: `apps/backend/src/estatistica/calculos/util.spec.ts`

- [ ] **Step 1: Criar o arquivo de tipos** (sem teste — só declarações)

```ts
// apps/backend/src/estatistica/estatistica.types.ts

export type UserRef = { id: string; nome: string; avatarUrl: string | null };

/** Linha de ranking informal: usuários empatados num mesmo valor. */
export type TopEntry = { usuarios: UserRef[]; valor: number };

/** Recorde ligado a uma rodada: pode haver empate entre (usuário, rodada). */
export type RecordeRodada = {
  valor: number;
  registros: Array<{ usuario: UserRef; publicacao: number }>;
};

// ---- Inputs normalizados (desacoplados do Prisma) para as calculadoras puras ----

export type SnapshotInput = {
  usuarioId: string;
  publicacaoNumero: number;
  posicao: number;
  posicoesGanhas: number;
  pontuacaoRodada: number;
  acertosPlacarExato: number;
};

export type JogoInput = {
  id: string;
  dataHora: Date;
  fase: string;
  pesoPontuacao: number;
  placarCasa: number;
  placarVisitante: number;
  /** "Brasil x França" — pronto para exibição. */
  descricao: string;
};

export type ApostaInput = {
  usuarioId: string;
  jogoId: string;
  placarCasa: number;
  placarVisitante: number;
  pontuacao: number | null;
  criadoEm: Date;
  palpiteAtualizadoEm: Date;
};

// ---- Payload ----

export type Posicoes = {
  reiDaLideranca: TopEntry[]; // top 3
  lanterna: TopEntry[]; // top 3
  foguete: RecordeRodada | null;
  quedaLivre: RecordeRodada | null;
  maisRegular: { usuarios: UserRef[]; valor: number } | null; // desvio padrão, 2 casas
  top5: TopEntry[]; // top 3
};

export type Recordes = {
  maiorPontuacaoRodada: RecordeRodada | null;
  rodadaGenerosa: { publicacao: number; media: number } | null;
  rodadaAvara: { publicacao: number; media: number } | null;
  reiDoPlacarExato: TopEntry[]; // top 3, snapshot da última publicação
  aproveitamentoPorFase: Array<{
    fase: string;
    aproveitamento: number; // 0–100
    melhor: { usuarios: UserRef[]; pontos: number } | null;
  }>;
};

export type Palpites = {
  placaresMaisApostados: Array<{ placar: string; quantidade: number }>; // top 8
  jogoConsensual: { jogo: string; placar: string; percentual: number } | null;
  jogoDividido: { jogo: string; placaresDistintos: number; percentualModal: number } | null;
  otimista: { usuarios: UserRef[]; mediaGols: number } | null;
  pessimista: { usuarios: UserRef[]; mediaGols: number } | null;
  mediaRealGols: number | null;
  ultimaHora: { usuarios: UserRef[]; medianaMinutos: number } | null;
  precavido: { usuarios: UserRef[]; medianaMinutos: number } | null;
  reenvios: TopEntry[]; // top 3
  empates: { percentualApostas: number; percentualJogos: number } | null;
  esquecidos: TopEntry[]; // top 3
};

export type Zebras = {
  zebra: { jogo: string; percentualPontuaram: number } | null;
  previsivel: { jogo: string; percentualPontuaram: number } | null;
  acertosSolitarios: Array<{ jogo: string; usuario: UserRef; placar: string }>; // até 10
};

export type EstatisticasBolao =
  | { temDados: false }
  | {
      temDados: true;
      ultimaPublicacao: { numero: number; publicadoEm: Date };
      posicoes: Posicoes;
      recordes: Recordes;
      palpites: Palpites;
      zebras: Zebras;
    };
```

- [ ] **Step 2: Escrever o teste falhando dos utilitários**

```ts
// apps/backend/src/estatistica/calculos/util.spec.ts
import { mediana, desvioPadrao, topEntries, incrementar } from './util';
import { UserRef } from '../estatistica.types';

const u = (id: string, nome: string): UserRef => ({ id, nome, avatarUrl: null });
const membros = new Map<string, UserRef>([
  ['u1', u('u1', 'Ana')],
  ['u2', u('u2', 'Bruno')],
  ['u3', u('u3', 'Carla')],
]);

describe('util', () => {
  it('mediana de lista ímpar e par', () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 2, 3])).toBe(2.5);
  });

  it('desvio padrão populacional', () => {
    expect(desvioPadrao([2, 2, 2])).toBe(0);
    expect(desvioPadrao([1, 3])).toBe(1);
  });

  it('incrementar soma contagens num Map', () => {
    const m = new Map<string, number>();
    incrementar(m, 'a');
    incrementar(m, 'a');
    expect(m.get('a')).toBe(2);
  });

  it('topEntries agrupa empatados, ordena desc e corta em N', () => {
    const contagens = new Map([['u1', 2], ['u2', 5], ['u3', 2]]);
    const top = topEntries(contagens, membros, 3);
    expect(top).toEqual([
      { valor: 5, usuarios: [u('u2', 'Bruno')] },
      { valor: 2, usuarios: [u('u1', 'Ana'), u('u3', 'Carla')] },
    ]);
  });

  it('topEntries descarta valores <= 0 e usuários fora do bolão', () => {
    const contagens = new Map([['u1', 0], ['desconhecido', 9]]);
    expect(topEntries(contagens, membros, 3)).toEqual([]);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd apps/backend; pnpm test -- --testPathPattern=estatistica`
Expected: FAIL — `Cannot find module './util'`

- [ ] **Step 4: Implementar os utilitários**

```ts
// apps/backend/src/estatistica/calculos/util.ts
import { TopEntry, UserRef } from '../estatistica.types';

export function mediana(valores: number[]): number {
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 === 0 ? (v[meio - 1] + v[meio]) / 2 : v[meio];
}

/** Desvio padrão populacional. */
export function desvioPadrao(valores: number[]): number {
  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  const variancia = valores.reduce((acc, x) => acc + (x - media) ** 2, 0) / valores.length;
  return Math.sqrt(variancia);
}

export function incrementar(mapa: Map<string, number>, chave: string, delta = 1): void {
  mapa.set(chave, (mapa.get(chave) ?? 0) + delta);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Converte contagens por usuário em linhas de ranking: empatados dividem a
 * linha, ordena por valor desc e corta nas N primeiras linhas. Valores <= 0
 * e usuários fora do mapa de membros são descartados.
 */
export function topEntries(
  contagens: Map<string, number>,
  membros: Map<string, UserRef>,
  n = 3,
): TopEntry[] {
  const grupos = new Map<number, UserRef[]>();
  for (const [usuarioId, valor] of contagens) {
    if (valor <= 0) continue;
    const usuario = membros.get(usuarioId);
    if (!usuario) continue;
    const lista = grupos.get(valor) ?? [];
    lista.push(usuario);
    grupos.set(valor, lista);
  }
  return [...grupos.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, n)
    .map(([valor, usuarios]) => ({
      valor,
      usuarios: [...usuarios].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    }));
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd apps/backend; pnpm test -- --testPathPattern=estatistica`
Expected: PASS (5 testes)

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/estatistica
git commit -m "feat(estatistica): tipos do payload e utilitarios de calculo"
```

---

### Task 2: Calculadora de posições (itens 1–6)

**Files:**
- Create: `apps/backend/src/estatistica/calculos/posicoes.ts`
- Test: `apps/backend/src/estatistica/calculos/posicoes.spec.ts`

- [ ] **Step 1: Escrever o teste falhando**

```ts
// apps/backend/src/estatistica/calculos/posicoes.spec.ts
import { calcularPosicoes } from './posicoes';
import { SnapshotInput, UserRef } from '../estatistica.types';

const u = (id: string, nome: string): UserRef => ({ id, nome, avatarUrl: null });
const membros = new Map<string, UserRef>([
  ['u1', u('u1', 'Ana')],
  ['u2', u('u2', 'Bruno')],
  ['u3', u('u3', 'Carla')],
]);

const snap = (
  usuarioId: string, publicacaoNumero: number, posicao: number, posicoesGanhas = 0,
): SnapshotInput => ({
  usuarioId, publicacaoNumero, posicao, posicoesGanhas,
  pontuacaoRodada: 0, acertosPlacarExato: 0,
});

// pub1: Ana 1º, Bruno 2º, Carla 3º
// pub2: Ana 1º, Carla 2º (+1), Bruno 3º (-1)
// pub3: Bruno 1º (+2), Ana 2º (-1), Carla 3º (-1)
const snapshots: SnapshotInput[] = [
  snap('u1', 1, 1), snap('u2', 1, 2), snap('u3', 1, 3),
  snap('u1', 2, 1), snap('u3', 2, 2, 1), snap('u2', 2, 3, -1),
  snap('u2', 3, 1, 2), snap('u1', 3, 2, -1), snap('u3', 3, 3, -1),
];

describe('calcularPosicoes', () => {
  it('rei da liderança conta rodadas em 1º', () => {
    const r = calcularPosicoes(snapshots, membros);
    expect(r.reiDaLideranca).toEqual([
      { valor: 2, usuarios: [u('u1', 'Ana')] },
      { valor: 1, usuarios: [u('u2', 'Bruno')] },
    ]);
  });

  it('lanterna conta rodadas na última posição da publicação', () => {
    const r = calcularPosicoes(snapshots, membros);
    expect(r.lanterna).toEqual([
      { valor: 2, usuarios: [u('u3', 'Carla')] },
      { valor: 1, usuarios: [u('u2', 'Bruno')] },
    ]);
  });

  it('foguete é o maior posicoesGanhas positivo, com a rodada', () => {
    const r = calcularPosicoes(snapshots, membros);
    expect(r.foguete).toEqual({
      valor: 2,
      registros: [{ usuario: u('u2', 'Bruno'), publicacao: 3 }],
    });
  });

  it('queda livre agrupa empatados no menor posicoesGanhas', () => {
    const r = calcularPosicoes(snapshots, membros);
    expect(r.quedaLivre!.valor).toBe(-1);
    expect(r.quedaLivre!.registros).toHaveLength(3);
  });

  it('mais regular usa desvio padrão de posição e agrupa empatados', () => {
    const r = calcularPosicoes(snapshots, membros);
    // Ana [1,1,2] e Carla [3,2,3] têm o mesmo desvio (0.47)
    expect(r.maisRegular).toEqual({
      valor: 0.47,
      usuarios: [u('u1', 'Ana'), u('u3', 'Carla')],
    });
  });

  it('exige pelo menos 2 publicações para o mais regular', () => {
    const r = calcularPosicoes([snap('u1', 1, 1)], membros);
    expect(r.maisRegular).toBeNull();
  });

  it('top 5 conta presenças em posicao <= 5', () => {
    const r = calcularPosicoes(snapshots, membros);
    expect(r.top5).toEqual([
      { valor: 3, usuarios: [u('u1', 'Ana'), u('u2', 'Bruno'), u('u3', 'Carla')] },
    ]);
  });

  it('sem foguete/queda quando ninguém subiu ou caiu', () => {
    const r = calcularPosicoes([snap('u1', 1, 1), snap('u2', 1, 2)], membros);
    expect(r.foguete).toBeNull();
    expect(r.quedaLivre).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/backend; pnpm test -- --testPathPattern=posicoes`
Expected: FAIL — `Cannot find module './posicoes'`

- [ ] **Step 3: Implementar**

```ts
// apps/backend/src/estatistica/calculos/posicoes.ts
import { Posicoes, RecordeRodada, SnapshotInput, UserRef } from '../estatistica.types';
import { desvioPadrao, incrementar, round2, topEntries } from './util';

export function calcularPosicoes(
  snapshots: SnapshotInput[],
  membros: Map<string, UserRef>,
): Posicoes {
  const lideres = new Map<string, number>();
  const lanternas = new Map<string, number>();
  const top5 = new Map<string, number>();
  const posicoesPorUsuario = new Map<string, number[]>();

  const porPublicacao = new Map<number, SnapshotInput[]>();
  for (const s of snapshots) {
    const lista = porPublicacao.get(s.publicacaoNumero) ?? [];
    lista.push(s);
    porPublicacao.set(s.publicacaoNumero, lista);
  }

  for (const snaps of porPublicacao.values()) {
    const maiorPosicao = Math.max(...snaps.map((s) => s.posicao));
    for (const s of snaps) {
      if (s.posicao === 1) incrementar(lideres, s.usuarioId);
      if (s.posicao === maiorPosicao) incrementar(lanternas, s.usuarioId);
      if (s.posicao <= 5) incrementar(top5, s.usuarioId);
      const posicoes = posicoesPorUsuario.get(s.usuarioId) ?? [];
      posicoes.push(s.posicao);
      posicoesPorUsuario.set(s.usuarioId, posicoes);
    }
  }

  return {
    reiDaLideranca: topEntries(lideres, membros),
    lanterna: topEntries(lanternas, membros),
    foguete: recordePosicoesGanhas(snapshots, membros, 'max'),
    quedaLivre: recordePosicoesGanhas(snapshots, membros, 'min'),
    maisRegular: maisRegular(posicoesPorUsuario, membros),
    top5: topEntries(top5, membros),
  };
}

function recordePosicoesGanhas(
  snapshots: SnapshotInput[],
  membros: Map<string, UserRef>,
  tipo: 'max' | 'min',
): RecordeRodada | null {
  const candidatos = snapshots.filter((s) =>
    tipo === 'max' ? s.posicoesGanhas > 0 : s.posicoesGanhas < 0,
  );
  if (candidatos.length === 0) return null;

  const valores = candidatos.map((s) => s.posicoesGanhas);
  const valor = tipo === 'max' ? Math.max(...valores) : Math.min(...valores);

  const registros = candidatos
    .filter((s) => s.posicoesGanhas === valor)
    .flatMap((s) => {
      const usuario = membros.get(s.usuarioId);
      return usuario ? [{ usuario, publicacao: s.publicacaoNumero }] : [];
    });
  return registros.length > 0 ? { valor, registros } : null;
}

function maisRegular(
  posicoesPorUsuario: Map<string, number[]>,
  membros: Map<string, UserRef>,
): { usuarios: UserRef[]; valor: number } | null {
  let menor: number | null = null;
  const desvios = new Map<string, number>();
  for (const [usuarioId, posicoes] of posicoesPorUsuario) {
    if (posicoes.length < 2 || !membros.has(usuarioId)) continue;
    const dv = round2(desvioPadrao(posicoes));
    desvios.set(usuarioId, dv);
    if (menor === null || dv < menor) menor = dv;
  }
  if (menor === null) return null;

  const usuarios = [...desvios.entries()]
    .filter(([, dv]) => dv === menor)
    .map(([usuarioId]) => membros.get(usuarioId)!)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return { usuarios, valor: menor };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/backend; pnpm test -- --testPathPattern=posicoes`
Expected: PASS (8 testes)

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/estatistica/calculos
git commit -m "feat(estatistica): calculadora de posicoes (itens 1-6)"
```

---

### Task 3: Calculadora de recordes (itens 7–10)

**Files:**
- Create: `apps/backend/src/estatistica/calculos/recordes.ts`
- Test: `apps/backend/src/estatistica/calculos/recordes.spec.ts`

- [ ] **Step 1: Escrever o teste falhando**

```ts
// apps/backend/src/estatistica/calculos/recordes.spec.ts
import { calcularRecordes } from './recordes';
import { ApostaInput, JogoInput, SnapshotInput, UserRef } from '../estatistica.types';

const u = (id: string, nome: string): UserRef => ({ id, nome, avatarUrl: null });
const membros = new Map<string, UserRef>([
  ['u1', u('u1', 'Ana')],
  ['u2', u('u2', 'Bruno')],
]);

const snap = (
  usuarioId: string, publicacaoNumero: number, pontuacaoRodada: number, acertosPlacarExato = 0,
): SnapshotInput => ({
  usuarioId, publicacaoNumero, posicao: 1, posicoesGanhas: 0,
  pontuacaoRodada, acertosPlacarExato,
});

const jogo = (id: string, fase: string, pesoPontuacao: number): JogoInput => ({
  id, fase, pesoPontuacao,
  dataHora: new Date('2026-06-15T15:00:00Z'),
  placarCasa: 1, placarVisitante: 0, descricao: 'A x B',
});

const aposta = (usuarioId: string, jogoId: string, pontuacao: number): ApostaInput => ({
  usuarioId, jogoId, pontuacao,
  placarCasa: 1, placarVisitante: 0,
  criadoEm: new Date('2026-06-10T10:00:00Z'),
  palpiteAtualizadoEm: new Date('2026-06-10T10:00:00Z'),
});

const snapshots: SnapshotInput[] = [
  snap('u1', 1, 10, 2), snap('u2', 1, 5, 0),
  snap('u1', 2, 3, 4), snap('u2', 2, 25, 1),
];

describe('calcularRecordes', () => {
  it('maior pontuação numa rodada, com a publicação', () => {
    const r = calcularRecordes(snapshots, [], [], membros, 10);
    expect(r.maiorPontuacaoRodada).toEqual({
      valor: 25,
      registros: [{ usuario: u('u2', 'Bruno'), publicacao: 2 }],
    });
  });

  it('rodada generosa e avara pela média de pontuacaoRodada', () => {
    const r = calcularRecordes(snapshots, [], [], membros, 10);
    expect(r.rodadaGenerosa).toEqual({ publicacao: 2, media: 14 }); // (3+25)/2
    expect(r.rodadaAvara).toEqual({ publicacao: 1, media: 7.5 }); // (10+5)/2
  });

  it('rei do placar exato usa o snapshot da última publicação', () => {
    const r = calcularRecordes(snapshots, [], [], membros, 10);
    expect(r.reiDoPlacarExato).toEqual([
      { valor: 4, usuarios: [u('u1', 'Ana')] },
      { valor: 1, usuarios: [u('u2', 'Bruno')] },
    ]);
  });

  it('aproveitamento por fase: pontos obtidos / máximo possível', () => {
    const jogos = [jogo('j1', 'GRUPOS', 1), jogo('j2', 'OITAVAS', 2)];
    const apostas = [
      aposta('u1', 'j1', 10), aposta('u2', 'j1', 0),
      aposta('u1', 'j2', 5), aposta('u2', 'j2', 20),
    ];
    // pontosExato=10 → máx GRUPOS = 2 membros × 10×1 = 20; obtidos 10 → 50%
    // máx OITAVAS = 2 × 10×2 = 40; obtidos 25 → 63%
    const r = calcularRecordes([], jogos, apostas, membros, 10);
    expect(r.aproveitamentoPorFase).toEqual([
      { fase: 'GRUPOS', aproveitamento: 50, melhor: { usuarios: [u('u1', 'Ana')], pontos: 10 } },
      { fase: 'OITAVAS', aproveitamento: 63, melhor: { usuarios: [u('u2', 'Bruno')], pontos: 20 } },
    ]);
  });

  it('retorna nulls/vazios sem dados', () => {
    const r = calcularRecordes([], [], [], membros, 10);
    expect(r.maiorPontuacaoRodada).toBeNull();
    expect(r.rodadaGenerosa).toBeNull();
    expect(r.rodadaAvara).toBeNull();
    expect(r.reiDoPlacarExato).toEqual([]);
    expect(r.aproveitamentoPorFase).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/backend; pnpm test -- --testPathPattern=recordes`
Expected: FAIL — `Cannot find module './recordes'`

- [ ] **Step 3: Implementar**

```ts
// apps/backend/src/estatistica/calculos/recordes.ts
import {
  ApostaInput, JogoInput, RecordeRodada, Recordes, SnapshotInput, UserRef,
} from '../estatistica.types';
import { incrementar, round2, topEntries } from './util';

const ORDEM_FASES = [
  'GRUPOS', 'SEGUNDA_FASE', 'OITAVAS', 'QUARTAS', 'SEMIS', 'TERCEIRO_LUGAR', 'FINAL',
];

export function calcularRecordes(
  snapshots: SnapshotInput[],
  jogos: JogoInput[],
  apostas: ApostaInput[],
  membros: Map<string, UserRef>,
  pontosPlacarExato: number,
): Recordes {
  return {
    maiorPontuacaoRodada: maiorPontuacaoRodada(snapshots, membros),
    ...mediasPorRodada(snapshots),
    reiDoPlacarExato: reiDoPlacarExato(snapshots, membros),
    aproveitamentoPorFase: aproveitamentoPorFase(jogos, apostas, membros, pontosPlacarExato),
  };
}

function maiorPontuacaoRodada(
  snapshots: SnapshotInput[],
  membros: Map<string, UserRef>,
): RecordeRodada | null {
  const candidatos = snapshots.filter((s) => s.pontuacaoRodada > 0);
  if (candidatos.length === 0) return null;
  const valor = Math.max(...candidatos.map((s) => s.pontuacaoRodada));
  const registros = candidatos
    .filter((s) => s.pontuacaoRodada === valor)
    .flatMap((s) => {
      const usuario = membros.get(s.usuarioId);
      return usuario ? [{ usuario, publicacao: s.publicacaoNumero }] : [];
    });
  return registros.length > 0 ? { valor, registros } : null;
}

function mediasPorRodada(snapshots: SnapshotInput[]): {
  rodadaGenerosa: { publicacao: number; media: number } | null;
  rodadaAvara: { publicacao: number; media: number } | null;
} {
  const somas = new Map<number, { total: number; qtd: number }>();
  for (const s of snapshots) {
    const acc = somas.get(s.publicacaoNumero) ?? { total: 0, qtd: 0 };
    acc.total += s.pontuacaoRodada;
    acc.qtd += 1;
    somas.set(s.publicacaoNumero, acc);
  }
  const medias = [...somas.entries()].map(([publicacao, { total, qtd }]) => ({
    publicacao,
    media: round2(total / qtd),
  }));
  if (medias.length === 0) return { rodadaGenerosa: null, rodadaAvara: null };

  const generosa = medias.reduce((a, b) => (b.media > a.media ? b : a));
  const avara = medias.reduce((a, b) => (b.media < a.media ? b : a));
  return { rodadaGenerosa: generosa, rodadaAvara: avara };
}

function reiDoPlacarExato(snapshots: SnapshotInput[], membros: Map<string, UserRef>) {
  if (snapshots.length === 0) return [];
  const ultima = Math.max(...snapshots.map((s) => s.publicacaoNumero));
  const contagens = new Map<string, number>();
  for (const s of snapshots) {
    if (s.publicacaoNumero === ultima) contagens.set(s.usuarioId, s.acertosPlacarExato);
  }
  return topEntries(contagens, membros);
}

function aproveitamentoPorFase(
  jogos: JogoInput[],
  apostas: ApostaInput[],
  membros: Map<string, UserRef>,
  pontosPlacarExato: number,
) {
  if (pontosPlacarExato <= 0 || membros.size === 0) return [];
  const apostasPorJogo = new Map<string, ApostaInput[]>();
  for (const a of apostas) {
    const lista = apostasPorJogo.get(a.jogoId) ?? [];
    lista.push(a);
    apostasPorJogo.set(a.jogoId, lista);
  }

  const resultado = [];
  for (const fase of ORDEM_FASES) {
    const jogosFase = jogos.filter((j) => j.fase === fase);
    if (jogosFase.length === 0) continue;

    const maxPossivel =
      membros.size *
      jogosFase.reduce((acc, j) => acc + pontosPlacarExato * j.pesoPontuacao, 0);

    const pontosPorUsuario = new Map<string, number>();
    let obtidos = 0;
    for (const j of jogosFase) {
      for (const a of apostasPorJogo.get(j.id) ?? []) {
        obtidos += a.pontuacao ?? 0;
        incrementar(pontosPorUsuario, a.usuarioId, a.pontuacao ?? 0);
      }
    }

    const melhores = topEntries(pontosPorUsuario, membros, 1);
    resultado.push({
      fase,
      aproveitamento: Math.round((obtidos / maxPossivel) * 100),
      melhor: melhores.length > 0
        ? { usuarios: melhores[0].usuarios, pontos: melhores[0].valor }
        : null,
    });
  }
  return resultado;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/backend; pnpm test -- --testPathPattern=recordes`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/estatistica/calculos
git commit -m "feat(estatistica): calculadora de recordes (itens 7-10)"
```

---

### Task 4: Calculadora de palpites (itens 11–16, 20)

**Files:**
- Create: `apps/backend/src/estatistica/calculos/palpites.ts`
- Test: `apps/backend/src/estatistica/calculos/palpites.spec.ts`

- [ ] **Step 1: Escrever o teste falhando**

```ts
// apps/backend/src/estatistica/calculos/palpites.spec.ts
import { calcularPalpites } from './palpites';
import { ApostaInput, JogoInput, UserRef } from '../estatistica.types';

const u = (id: string, nome: string): UserRef => ({ id, nome, avatarUrl: null });
const membros = new Map<string, UserRef>([
  ['u1', u('u1', 'Ana')],
  ['u2', u('u2', 'Bruno')],
  ['u3', u('u3', 'Carla')],
]);

const jogo = (id: string, placarCasa: number, placarVisitante: number, hora = '15:00'): JogoInput => ({
  id, placarCasa, placarVisitante,
  dataHora: new Date(`2026-06-15T${hora}:00Z`),
  fase: 'GRUPOS', pesoPontuacao: 1, descricao: `Jogo ${id}`,
});

// Aposta enviada `minutosAntesFechamento` antes do fechamento (dataHora - 60min).
function aposta(
  usuarioId: string, j: JogoInput, placarCasa: number, placarVisitante: number,
  opts: { minutosAntesFechamento?: number; reenviada?: boolean; pontuacao?: number } = {},
): ApostaInput {
  const fechamento = j.dataHora.getTime() - 60 * 60 * 1000;
  const enviadaEm = new Date(fechamento - (opts.minutosAntesFechamento ?? 120) * 60 * 1000);
  return {
    usuarioId, jogoId: j.id, placarCasa, placarVisitante,
    pontuacao: opts.pontuacao ?? 0,
    criadoEm: enviadaEm,
    palpiteAtualizadoEm: opts.reenviada
      ? new Date(enviadaEm.getTime() + 10_000)
      : enviadaEm,
  };
}

describe('calcularPalpites', () => {
  const j1 = jogo('j1', 2, 1);
  const j2 = jogo('j2', 1, 1, '18:00');

  it('placares mais apostados agrupa por par ordenado', () => {
    const r = calcularPalpites([j1, j2], [
      aposta('u1', j1, 2, 1), aposta('u2', j1, 2, 1), aposta('u3', j1, 0, 0),
      aposta('u1', j2, 2, 1),
    ], membros);
    expect(r.placaresMaisApostados[0]).toEqual({ placar: '2x1', quantidade: 3 });
    expect(r.placaresMaisApostados[1]).toEqual({ placar: '0x0', quantidade: 1 });
  });

  it('consensual e dividido por percentual do placar modal', () => {
    const r = calcularPalpites([j1, j2], [
      // j1: 3 apostas iguais → 100% modal
      aposta('u1', j1, 1, 0), aposta('u2', j1, 1, 0), aposta('u3', j1, 1, 0),
      // j2: 3 placares distintos → 33% modal
      aposta('u1', j2, 1, 0), aposta('u2', j2, 2, 0), aposta('u3', j2, 0, 0),
    ], membros);
    expect(r.jogoConsensual).toEqual({ jogo: 'Jogo j1', placar: '1x0', percentual: 100 });
    expect(r.jogoDividido).toEqual({ jogo: 'Jogo j2', placaresDistintos: 3, percentualModal: 33 });
  });

  it('otimista/pessimista exigem mínimo de 5 apostas', () => {
    const jogos = [1, 2, 3, 4, 5].map((n) => jogo(`g${n}`, 1, 0));
    const apostas = jogos.flatMap((j) => [
      aposta('u1', j, 3, 2), // 5 gols/jogo
      aposta('u2', j, 0, 0), // 0 gols/jogo
    ]);
    apostas.push(aposta('u3', jogos[0], 9, 9)); // só 1 aposta — fora
    const r = calcularPalpites(jogos, apostas, membros);
    expect(r.otimista).toEqual({ usuarios: [u('u1', 'Ana')], mediaGols: 5 });
    expect(r.pessimista).toEqual({ usuarios: [u('u2', 'Bruno')], mediaGols: 0 });
    expect(r.mediaRealGols).toBe(1);
  });

  it('última hora e precavido pela mediana de antecedência (min 5 apostas)', () => {
    const jogos = [1, 2, 3, 4, 5].map((n) => jogo(`g${n}`, 1, 0));
    const apostas = jogos.flatMap((j) => [
      aposta('u1', j, 1, 0, { minutosAntesFechamento: 5 }),
      aposta('u2', j, 1, 0, { minutosAntesFechamento: 2000 }),
    ]);
    const r = calcularPalpites(jogos, apostas, membros);
    expect(r.ultimaHora).toEqual({ usuarios: [u('u1', 'Ana')], medianaMinutos: 5 });
    expect(r.precavido).toEqual({ usuarios: [u('u2', 'Bruno')], medianaMinutos: 2000 });
  });

  it('reenvios conta apostas com palpiteAtualizadoEm > criadoEm + 2s', () => {
    const r = calcularPalpites([j1, j2], [
      aposta('u1', j1, 1, 0, { reenviada: true }),
      aposta('u1', j2, 1, 0, { reenviada: true }),
      aposta('u2', j1, 1, 0),
    ], membros);
    expect(r.reenvios).toEqual([{ valor: 2, usuarios: [u('u1', 'Ana')] }]);
  });

  it('percentual de empates apostados vs reais', () => {
    const r = calcularPalpites([j1, j2], [
      aposta('u1', j1, 1, 1), aposta('u2', j1, 2, 1),
      aposta('u1', j2, 0, 0), aposta('u2', j2, 2, 0),
    ], membros);
    // 2 de 4 apostas em empate = 50%; 1 de 2 jogos empatou (j2 1x1) = 50%
    expect(r.empates).toEqual({ percentualApostas: 50, percentualJogos: 50 });
  });

  it('esquecidos conta jogos publicados sem aposta do membro', () => {
    const r = calcularPalpites([j1, j2], [
      aposta('u1', j1, 1, 0), aposta('u1', j2, 1, 0),
      aposta('u2', j1, 1, 0),
    ], membros);
    expect(r.esquecidos).toEqual([
      { valor: 2, usuarios: [u('u3', 'Carla')] },
      { valor: 1, usuarios: [u('u2', 'Bruno')] },
    ]);
  });

  it('retorna nulls/vazios sem jogos publicados', () => {
    const r = calcularPalpites([], [], membros);
    expect(r.placaresMaisApostados).toEqual([]);
    expect(r.jogoConsensual).toBeNull();
    expect(r.mediaRealGols).toBeNull();
    expect(r.empates).toBeNull();
    expect(r.esquecidos).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/backend; pnpm test -- --testPathPattern=palpites`
Expected: FAIL — `Cannot find module './palpites'`

- [ ] **Step 3: Implementar**

```ts
// apps/backend/src/estatistica/calculos/palpites.ts
import { MINUTOS_PRAZO_APOSTA } from '@bolao/shared';
import { ApostaInput, JogoInput, Palpites, UserRef } from '../estatistica.types';
import { incrementar, mediana, round2, topEntries } from './util';

const MIN_APOSTAS_MEDIA = 5;
const TOLERANCIA_REENVIO_MS = 2000;
const TOP_PLACARES = 8;

export function calcularPalpites(
  jogos: JogoInput[],
  apostas: ApostaInput[],
  membros: Map<string, UserRef>,
): Palpites {
  return {
    placaresMaisApostados: placaresMaisApostados(apostas),
    ...consensoDivisao(jogos, apostas),
    ...otimistaPessimista(apostas, membros),
    mediaRealGols:
      jogos.length > 0
        ? round2(jogos.reduce((acc, j) => acc + j.placarCasa + j.placarVisitante, 0) / jogos.length)
        : null,
    ...antecedencia(jogos, apostas, membros),
    reenvios: reenvios(apostas, membros),
    empates: empates(jogos, apostas),
    esquecidos: esquecidos(jogos, apostas, membros),
  };
}

function placaresMaisApostados(apostas: ApostaInput[]) {
  const contagens = new Map<string, number>();
  for (const a of apostas) incrementar(contagens, `${a.placarCasa}x${a.placarVisitante}`);
  return [...contagens.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_PLACARES)
    .map(([placar, quantidade]) => ({ placar, quantidade }));
}

function consensoDivisao(jogos: JogoInput[], apostas: ApostaInput[]) {
  type Info = {
    jogo: string; total: number; distintos: number;
    placarModal: string; percentualModal: number;
  };
  const infos: Info[] = [];
  for (const j of jogos) {
    const doJogo = apostas.filter((a) => a.jogoId === j.id);
    if (doJogo.length < 2) continue;
    const contagens = new Map<string, number>();
    for (const a of doJogo) incrementar(contagens, `${a.placarCasa}x${a.placarVisitante}`);
    const [placarModal, qtdModal] = [...contagens.entries()].sort((a, b) => b[1] - a[1])[0];
    infos.push({
      jogo: j.descricao,
      total: doJogo.length,
      distintos: contagens.size,
      placarModal,
      percentualModal: Math.round((qtdModal / doJogo.length) * 100),
    });
  }
  if (infos.length === 0) return { jogoConsensual: null, jogoDividido: null };

  const consensual = [...infos].sort(
    (a, b) => b.percentualModal - a.percentualModal || b.total - a.total,
  )[0];
  const dividido = [...infos].sort(
    (a, b) => b.distintos - a.distintos || a.percentualModal - b.percentualModal,
  )[0];
  return {
    jogoConsensual: {
      jogo: consensual.jogo, placar: consensual.placarModal, percentual: consensual.percentualModal,
    },
    jogoDividido: {
      jogo: dividido.jogo, placaresDistintos: dividido.distintos,
      percentualModal: dividido.percentualModal,
    },
  };
}

function otimistaPessimista(apostas: ApostaInput[], membros: Map<string, UserRef>) {
  const medias = mediasPorUsuario(
    apostas, membros, (a) => a.placarCasa + a.placarVisitante, (golsPorAposta) =>
      round2(golsPorAposta.reduce((x, y) => x + y, 0) / golsPorAposta.length),
  );
  if (medias.size === 0) return { otimista: null, pessimista: null };
  const otimista = extremo(medias, membros, 'max');
  const pessimista = extremo(medias, membros, 'min');
  return {
    otimista: { usuarios: otimista.usuarios, mediaGols: otimista.valor },
    pessimista: { usuarios: pessimista.usuarios, mediaGols: pessimista.valor },
  };
}

function antecedencia(
  jogos: JogoInput[], apostas: ApostaInput[], membros: Map<string, UserRef>,
) {
  const fechamentos = new Map(
    jogos.map((j) => [j.id, j.dataHora.getTime() - MINUTOS_PRAZO_APOSTA * 60 * 1000]),
  );
  const medianas = mediasPorUsuario(
    apostas, membros,
    (a) => ((fechamentos.get(a.jogoId) ?? 0) - a.palpiteAtualizadoEm.getTime()) / 60_000,
    (minutos) => Math.round(mediana(minutos)),
  );
  if (medianas.size === 0) return { ultimaHora: null, precavido: null };
  const ultima = extremo(medianas, membros, 'min');
  const precavido = extremo(medianas, membros, 'max');
  return {
    ultimaHora: { usuarios: ultima.usuarios, medianaMinutos: ultima.valor },
    precavido: { usuarios: precavido.usuarios, medianaMinutos: precavido.valor },
  };
}

/** Agrega um valor por aposta em uma medida por usuário, exigindo o mínimo de apostas. */
function mediasPorUsuario(
  apostas: ApostaInput[],
  membros: Map<string, UserRef>,
  valorDaAposta: (a: ApostaInput) => number,
  agregador: (valores: number[]) => number,
): Map<string, number> {
  const valoresPorUsuario = new Map<string, number[]>();
  for (const a of apostas) {
    if (!membros.has(a.usuarioId)) continue;
    const lista = valoresPorUsuario.get(a.usuarioId) ?? [];
    lista.push(valorDaAposta(a));
    valoresPorUsuario.set(a.usuarioId, lista);
  }
  const resultado = new Map<string, number>();
  for (const [usuarioId, valores] of valoresPorUsuario) {
    if (valores.length >= MIN_APOSTAS_MEDIA) resultado.set(usuarioId, agregador(valores));
  }
  return resultado;
}

function extremo(
  medidas: Map<string, number>, membros: Map<string, UserRef>, tipo: 'max' | 'min',
): { usuarios: UserRef[]; valor: number } {
  const valores = [...medidas.values()];
  const valor = tipo === 'max' ? Math.max(...valores) : Math.min(...valores);
  const usuarios = [...medidas.entries()]
    .filter(([, v]) => v === valor)
    .map(([id]) => membros.get(id)!)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return { usuarios, valor };
}

function reenvios(apostas: ApostaInput[], membros: Map<string, UserRef>) {
  const contagens = new Map<string, number>();
  for (const a of apostas) {
    const delta = a.palpiteAtualizadoEm.getTime() - a.criadoEm.getTime();
    if (delta > TOLERANCIA_REENVIO_MS) incrementar(contagens, a.usuarioId);
  }
  return topEntries(contagens, membros);
}

function empates(jogos: JogoInput[], apostas: ApostaInput[]) {
  if (apostas.length === 0 || jogos.length === 0) return null;
  const apostasEmpate = apostas.filter((a) => a.placarCasa === a.placarVisitante).length;
  const jogosEmpate = jogos.filter((j) => j.placarCasa === j.placarVisitante).length;
  return {
    percentualApostas: Math.round((apostasEmpate / apostas.length) * 100),
    percentualJogos: Math.round((jogosEmpate / jogos.length) * 100),
  };
}

function esquecidos(
  jogos: JogoInput[], apostas: ApostaInput[], membros: Map<string, UserRef>,
) {
  if (jogos.length === 0) return [];
  const apostasPorUsuario = new Map<string, number>();
  for (const a of apostas) incrementar(apostasPorUsuario, a.usuarioId);
  const faltas = new Map<string, number>();
  for (const usuarioId of membros.keys()) {
    faltas.set(usuarioId, jogos.length - (apostasPorUsuario.get(usuarioId) ?? 0));
  }
  return topEntries(faltas, membros);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/backend; pnpm test -- --testPathPattern=palpites`
Expected: PASS (8 testes)

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/estatistica/calculos
git commit -m "feat(estatistica): calculadora de palpites (itens 11-16, 20)"
```

---

### Task 5: Calculadora de zebras (itens 17–19)

**Files:**
- Create: `apps/backend/src/estatistica/calculos/zebras.ts`
- Test: `apps/backend/src/estatistica/calculos/zebras.spec.ts`

- [ ] **Step 1: Escrever o teste falhando**

```ts
// apps/backend/src/estatistica/calculos/zebras.spec.ts
import { calcularZebras } from './zebras';
import { ApostaInput, JogoInput, UserRef } from '../estatistica.types';

const u = (id: string, nome: string): UserRef => ({ id, nome, avatarUrl: null });
const membros = new Map<string, UserRef>([
  ['u1', u('u1', 'Ana')],
  ['u2', u('u2', 'Bruno')],
]);

const jogo = (
  id: string, placarCasa: number, placarVisitante: number, dia: number,
): JogoInput => ({
  id, placarCasa, placarVisitante,
  dataHora: new Date(`2026-06-${String(dia).padStart(2, '0')}T15:00:00Z`),
  fase: 'GRUPOS', pesoPontuacao: 1, descricao: `Jogo ${id}`,
});

const aposta = (
  usuarioId: string, jogoId: string, placarCasa: number, placarVisitante: number,
  pontuacao: number,
): ApostaInput => ({
  usuarioId, jogoId, placarCasa, placarVisitante, pontuacao,
  criadoEm: new Date('2026-06-01T10:00:00Z'),
  palpiteAtualizadoEm: new Date('2026-06-01T10:00:00Z'),
});

describe('calcularZebras', () => {
  const j1 = jogo('j1', 2, 1, 10); // Ana cravou, Bruno errou → 50% pontuaram
  const j2 = jogo('j2', 1, 1, 12); // ambos pontuaram → 100%
  const apostas = [
    aposta('u1', 'j1', 2, 1, 10), aposta('u2', 'j1', 0, 0, 0),
    aposta('u1', 'j2', 0, 0, 5), aposta('u2', 'j2', 1, 1, 10),
  ];

  it('zebra é o jogo com menor % de apostas pontuadas; previsível o maior', () => {
    const r = calcularZebras([j1, j2], apostas, membros);
    expect(r.zebra).toEqual({ jogo: 'Jogo j1', percentualPontuaram: 50 });
    expect(r.previsivel).toEqual({ jogo: 'Jogo j2', percentualPontuaram: 100 });
  });

  it('acertos solitários: exatamente 1 membro cravou o placar', () => {
    const r = calcularZebras([j1, j2], apostas, membros);
    // j2 (mais recente) primeiro: Bruno cravou 1x1 sozinho; em j1 Ana cravou 2x1 sozinha
    expect(r.acertosSolitarios).toEqual([
      { jogo: 'Jogo j2', usuario: u('u2', 'Bruno'), placar: '1x1' },
      { jogo: 'Jogo j1', usuario: u('u1', 'Ana'), placar: '2x1' },
    ]);
  });

  it('jogo onde 2 membros cravaram não gera acerto solitário', () => {
    const r = calcularZebras([j1], [
      aposta('u1', 'j1', 2, 1, 10), aposta('u2', 'j1', 2, 1, 10),
    ], membros);
    expect(r.acertosSolitarios).toEqual([]);
  });

  it('retorna nulls/vazios sem apostas', () => {
    const r = calcularZebras([j1], [], membros);
    expect(r.zebra).toBeNull();
    expect(r.previsivel).toBeNull();
    expect(r.acertosSolitarios).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/backend; pnpm test -- --testPathPattern=zebras`
Expected: FAIL — `Cannot find module './zebras'`

- [ ] **Step 3: Implementar**

```ts
// apps/backend/src/estatistica/calculos/zebras.ts
import { ApostaInput, JogoInput, UserRef, Zebras } from '../estatistica.types';

const MAX_SOLITARIOS = 10;

export function calcularZebras(
  jogos: JogoInput[],
  apostas: ApostaInput[],
  membros: Map<string, UserRef>,
): Zebras {
  const apostasPorJogo = new Map<string, ApostaInput[]>();
  for (const a of apostas) {
    if (!membros.has(a.usuarioId)) continue;
    const lista = apostasPorJogo.get(a.jogoId) ?? [];
    lista.push(a);
    apostasPorJogo.set(a.jogoId, lista);
  }

  const percentuais: Array<{ jogo: string; percentualPontuaram: number }> = [];
  const solitarios: Zebras['acertosSolitarios'] = [];

  // Mais recentes primeiro, para a lista de solitários já sair ordenada.
  const ordenados = [...jogos].sort((a, b) => b.dataHora.getTime() - a.dataHora.getTime());

  for (const j of ordenados) {
    const doJogo = apostasPorJogo.get(j.id) ?? [];
    if (doJogo.length === 0) continue;

    const pontuaram = doJogo.filter((a) => (a.pontuacao ?? 0) > 0).length;
    percentuais.push({
      jogo: j.descricao,
      percentualPontuaram: Math.round((pontuaram / doJogo.length) * 100),
    });

    const exatas = doJogo.filter(
      (a) => a.placarCasa === j.placarCasa && a.placarVisitante === j.placarVisitante,
    );
    if (exatas.length === 1 && solitarios.length < MAX_SOLITARIOS) {
      solitarios.push({
        jogo: j.descricao,
        usuario: membros.get(exatas[0].usuarioId)!,
        placar: `${j.placarCasa}x${j.placarVisitante}`,
      });
    }
  }

  if (percentuais.length === 0) {
    return { zebra: null, previsivel: null, acertosSolitarios: solitarios };
  }
  const zebra = percentuais.reduce((a, b) =>
    b.percentualPontuaram < a.percentualPontuaram ? b : a,
  );
  const previsivel = percentuais.reduce((a, b) =>
    b.percentualPontuaram > a.percentualPontuaram ? b : a,
  );
  return { zebra, previsivel, acertosSolitarios: solitarios };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/backend; pnpm test -- --testPathPattern=zebras`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/estatistica/calculos
git commit -m "feat(estatistica): calculadora de zebras (itens 17-19)"
```

---

### Task 6: EstatisticaService (membership, fetch, cache, orquestração)

**Files:**
- Create: `apps/backend/src/estatistica/estatistica.service.ts`
- Test: `apps/backend/src/estatistica/estatistica.service.spec.ts`

- [ ] **Step 1: Escrever o teste falhando**

```ts
// apps/backend/src/estatistica/estatistica.service.spec.ts
import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EstatisticaService } from './estatistica.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  bolao: { findUnique: jest.fn() },
  bolaoMembro: { findUnique: jest.fn(), findMany: jest.fn() },
  publicacao: { findFirst: jest.fn() },
  rankingSnapshot: { findMany: jest.fn() },
  jogo: { findMany: jest.fn() },
  aposta: { findMany: jest.fn() },
  configuracaoPontuacao: { findFirst: jest.fn() },
};

const publicacao1 = { id: 'pub-1', numero: 1, publicadoEm: new Date('2026-06-20T12:00:00Z') };

function mockDatasetsVazios() {
  prismaMock.bolaoMembro.findMany.mockResolvedValue([
    { usuario: { id: 'u1', nome: 'Ana', avatarUrl: null } },
  ]);
  prismaMock.rankingSnapshot.findMany.mockResolvedValue([
    {
      usuarioId: 'u1', posicao: 1, posicoesGanhas: 0, pontuacaoRodada: 10,
      acertosPlacarExato: 1, publicacao: { numero: 1 },
    },
  ]);
  prismaMock.jogo.findMany.mockResolvedValue([]);
  prismaMock.aposta.findMany.mockResolvedValue([]);
  prismaMock.configuracaoPontuacao.findFirst.mockResolvedValue({ nivel: 1, pontos: 10 });
}

describe('EstatisticaService', () => {
  let service: EstatisticaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [EstatisticaService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(EstatisticaService);
    jest.clearAllMocks();
    prismaMock.bolao.findUnique.mockResolvedValue({ id: 'bolao-1' });
    prismaMock.bolaoMembro.findUnique.mockResolvedValue({ id: 'membro-1' });
    prismaMock.publicacao.findFirst.mockResolvedValue(publicacao1);
  });

  it('lança NotFoundException para bolão inexistente', async () => {
    prismaMock.bolao.findUnique.mockResolvedValue(null);
    await expect(service.obter('nao-existe', 'u1')).rejects.toThrow(NotFoundException);
  });

  it('lança ForbiddenException para não-membro', async () => {
    prismaMock.bolaoMembro.findUnique.mockResolvedValue(null);
    await expect(service.obter('bolao-1', 'u1')).rejects.toThrow(ForbiddenException);
  });

  it('retorna temDados false sem publicação', async () => {
    prismaMock.publicacao.findFirst.mockResolvedValue(null);
    expect(await service.obter('bolao-1', 'u1')).toEqual({ temDados: false });
  });

  it('retorna temDados false quando o bolão não tem snapshots', async () => {
    mockDatasetsVazios();
    prismaMock.rankingSnapshot.findMany.mockResolvedValue([]);
    expect(await service.obter('bolao-1', 'u1')).toEqual({ temDados: false });
  });

  it('monta o payload completo e informa a última publicação', async () => {
    mockDatasetsVazios();
    const r = await service.obter('bolao-1', 'u1');
    expect(r.temDados).toBe(true);
    if (r.temDados) {
      expect(r.ultimaPublicacao).toEqual({ numero: 1, publicadoEm: publicacao1.publicadoEm });
      expect(r.posicoes.reiDaLideranca).toEqual([
        { valor: 1, usuarios: [{ id: 'u1', nome: 'Ana', avatarUrl: null }] },
      ]);
      expect(r.recordes.maiorPontuacaoRodada!.valor).toBe(10);
    }
  });

  it('cacheia por publicação: segunda chamada não recalcula', async () => {
    mockDatasetsVazios();
    await service.obter('bolao-1', 'u1');
    await service.obter('bolao-1', 'u1');
    expect(prismaMock.rankingSnapshot.findMany).toHaveBeenCalledTimes(1);
  });

  it('nova publicação invalida o cache', async () => {
    mockDatasetsVazios();
    await service.obter('bolao-1', 'u1');
    prismaMock.publicacao.findFirst.mockResolvedValue({ ...publicacao1, id: 'pub-2', numero: 2 });
    await service.obter('bolao-1', 'u1');
    expect(prismaMock.rankingSnapshot.findMany).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/backend; pnpm test -- --testPathPattern=estatistica.service`
Expected: FAIL — `Cannot find module './estatistica.service'`

- [ ] **Step 3: Implementar o service**

```ts
// apps/backend/src/estatistica/estatistica.service.ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstatisticasBolao, UserRef } from './estatistica.types';
import { calcularPosicoes } from './calculos/posicoes';
import { calcularRecordes } from './calculos/recordes';
import { calcularPalpites } from './calculos/palpites';
import { calcularZebras } from './calculos/zebras';

type Publicacao = { id: string; numero: number; publicadoEm: Date };

@Injectable()
export class EstatisticaService {
  /** Uma entrada por bolão; a chave de validade é o id da última publicação. */
  private cache = new Map<string, { publicacaoId: string; data: EstatisticasBolao }>();

  constructor(private prisma: PrismaService) {}

  async obter(bolaoId: string, usuarioId: string): Promise<EstatisticasBolao> {
    const bolao = await this.prisma.bolao.findUnique({ where: { id: bolaoId } });
    if (!bolao) throw new NotFoundException('Bolão não encontrado.');

    const membro = await this.prisma.bolaoMembro.findUnique({
      where: { bolaoId_usuarioId: { bolaoId, usuarioId } },
    });
    if (!membro) throw new ForbiddenException('Você não é membro deste bolão.');

    const ultima = await this.prisma.publicacao.findFirst({
      orderBy: { numero: 'desc' },
      select: { id: true, numero: true, publicadoEm: true },
    });
    if (!ultima) return { temDados: false };

    const cached = this.cache.get(bolaoId);
    if (cached?.publicacaoId === ultima.id) return cached.data;

    const data = await this.calcular(bolaoId, ultima);
    this.cache.set(bolaoId, { publicacaoId: ultima.id, data });
    return data;
  }

  private async calcular(bolaoId: string, ultima: Publicacao): Promise<EstatisticasBolao> {
    const membrosDb = await this.prisma.bolaoMembro.findMany({
      where: { bolaoId, usuario: { ativo: true } },
      select: { usuario: { select: { id: true, nome: true, avatarUrl: true } } },
    });
    const membros = new Map<string, UserRef>(membrosDb.map((m) => [m.usuario.id, m.usuario]));

    const snapshotsDb = await this.prisma.rankingSnapshot.findMany({
      where: { bolaoId, usuario: { ativo: true } },
      select: {
        usuarioId: true, posicao: true, posicoesGanhas: true,
        pontuacaoRodada: true, acertosPlacarExato: true,
        publicacao: { select: { numero: true } },
      },
    });
    if (snapshotsDb.length === 0) return { temDados: false };
    const snapshots = snapshotsDb.map((s) => ({
      usuarioId: s.usuarioId,
      publicacaoNumero: s.publicacao.numero,
      posicao: s.posicao,
      posicoesGanhas: s.posicoesGanhas,
      pontuacaoRodada: s.pontuacaoRodada,
      acertosPlacarExato: s.acertosPlacarExato,
    }));

    const jogosDb = await this.prisma.jogo.findMany({
      where: {
        publicacaoId: { not: null },
        placarCasa: { not: null },
        placarVisitante: { not: null },
      },
      select: {
        id: true, dataHora: true, fase: true, pesoPontuacao: true,
        placarCasa: true, placarVisitante: true,
        selecaoCasa: { select: { nome: true } },
        selecaoVisitante: { select: { nome: true } },
      },
    });
    const jogos = jogosDb.map((j) => ({
      id: j.id,
      dataHora: j.dataHora,
      fase: j.fase as string,
      pesoPontuacao: j.pesoPontuacao,
      placarCasa: j.placarCasa!,
      placarVisitante: j.placarVisitante!,
      descricao: `${j.selecaoCasa.nome} x ${j.selecaoVisitante.nome}`,
    }));

    const apostas = await this.prisma.aposta.findMany({
      where: {
        usuarioId: { in: [...membros.keys()] },
        jogoId: { in: jogos.map((j) => j.id) },
      },
      select: {
        usuarioId: true, jogoId: true, placarCasa: true, placarVisitante: true,
        pontuacao: true, criadoEm: true, palpiteAtualizadoEm: true,
      },
    });

    const config = await this.prisma.configuracaoPontuacao.findFirst({ where: { nivel: 1 } });
    const pontosPlacarExato = config?.pontos ?? 0;

    return {
      temDados: true,
      ultimaPublicacao: { numero: ultima.numero, publicadoEm: ultima.publicadoEm },
      posicoes: calcularPosicoes(snapshots, membros),
      recordes: calcularRecordes(snapshots, jogos, apostas, membros, pontosPlacarExato),
      palpites: calcularPalpites(jogos, apostas, membros),
      zebras: calcularZebras(jogos, apostas, membros),
    };
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/backend; pnpm test -- --testPathPattern=estatistica.service`
Expected: PASS (7 testes)

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/estatistica
git commit -m "feat(estatistica): service com membership, cache por publicacao e orquestracao"
```

---

### Task 7: Controller, module e wiring

**Files:**
- Create: `apps/backend/src/estatistica/estatistica.controller.ts`
- Create: `apps/backend/src/estatistica/estatistica.module.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: Criar o controller**

```ts
// apps/backend/src/estatistica/estatistica.controller.ts
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EstatisticaService } from './estatistica.service';

@UseGuards(JwtAuthGuard)
@Controller('boloes/:bolaoId/estatisticas')
export class EstatisticaController {
  constructor(private service: EstatisticaService) {}

  @Get()
  obter(@Param('bolaoId') bolaoId: string, @CurrentUser() user: { id: string }) {
    return this.service.obter(bolaoId, user.id);
  }
}
```

- [ ] **Step 2: Criar o module**

```ts
// apps/backend/src/estatistica/estatistica.module.ts
import { Module } from '@nestjs/common';
import { EstatisticaController } from './estatistica.controller';
import { EstatisticaService } from './estatistica.service';

@Module({ controllers: [EstatisticaController], providers: [EstatisticaService] })
export class EstatisticaModule {}
```

- [ ] **Step 3: Registrar no AppModule**

Em `apps/backend/src/app.module.ts`, adicionar o import e a entrada no array `imports` (depois de `PublicacaoModule`):

```ts
import { EstatisticaModule } from './estatistica/estatistica.module';
// ...
    PublicacaoModule,
    EstatisticaModule,
```

- [ ] **Step 4: Typecheck e testes do backend**

Run: `cd apps/backend; pnpm exec tsc --noEmit`
Expected: sem erros

Run: `cd apps/backend; pnpm test -- --testPathPattern=estatistica`
Expected: PASS (todos os specs de estatística)

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/estatistica apps/backend/src/app.module.ts
git commit -m "feat(estatistica): endpoint GET /boloes/:bolaoId/estatisticas"
```

---

### Task 8: Frontend — tipos e EstatisticaCard

**Files:**
- Modify: `apps/frontend/src/types/api.ts` (acrescentar tipos ao final)
- Create: `apps/frontend/src/components/estatisticas/EstatisticaCard.tsx`
- Test: `apps/frontend/src/__tests__/EstatisticaCard.test.tsx`

- [ ] **Step 1: Acrescentar os tipos do payload em `types/api.ts`** (ao final do arquivo; datas viram `string` no JSON)

```ts
// --- Estatísticas do bolão ---

export type UsuarioRef = { id: string; nome: string; avatarUrl: string | null };
export type TopEntry = { usuarios: UsuarioRef[]; valor: number };
export type RecordeRodada = {
  valor: number;
  registros: Array<{ usuario: UsuarioRef; publicacao: number }>;
};

export type EstatisticasBolao =
  | { temDados: false }
  | {
      temDados: true;
      ultimaPublicacao: { numero: number; publicadoEm: string };
      posicoes: {
        reiDaLideranca: TopEntry[];
        lanterna: TopEntry[];
        foguete: RecordeRodada | null;
        quedaLivre: RecordeRodada | null;
        maisRegular: { usuarios: UsuarioRef[]; valor: number } | null;
        top5: TopEntry[];
      };
      recordes: {
        maiorPontuacaoRodada: RecordeRodada | null;
        rodadaGenerosa: { publicacao: number; media: number } | null;
        rodadaAvara: { publicacao: number; media: number } | null;
        reiDoPlacarExato: TopEntry[];
        aproveitamentoPorFase: Array<{
          fase: string;
          aproveitamento: number;
          melhor: { usuarios: UsuarioRef[]; pontos: number } | null;
        }>;
      };
      palpites: {
        placaresMaisApostados: Array<{ placar: string; quantidade: number }>;
        jogoConsensual: { jogo: string; placar: string; percentual: number } | null;
        jogoDividido: { jogo: string; placaresDistintos: number; percentualModal: number } | null;
        otimista: { usuarios: UsuarioRef[]; mediaGols: number } | null;
        pessimista: { usuarios: UsuarioRef[]; mediaGols: number } | null;
        mediaRealGols: number | null;
        ultimaHora: { usuarios: UsuarioRef[]; medianaMinutos: number } | null;
        precavido: { usuarios: UsuarioRef[]; medianaMinutos: number } | null;
        reenvios: TopEntry[];
        empates: { percentualApostas: number; percentualJogos: number } | null;
        esquecidos: TopEntry[];
      };
      zebras: {
        zebra: { jogo: string; percentualPontuaram: number } | null;
        previsivel: { jogo: string; percentualPontuaram: number } | null;
        acertosSolitarios: Array<{ jogo: string; usuario: UsuarioRef; placar: string }>;
      };
    };
```

- [ ] **Step 2: Escrever o teste falhando do card**

```tsx
// apps/frontend/src/__tests__/EstatisticaCard.test.tsx
import { render, screen } from '@testing-library/react';
import { EstatisticaCard } from '@/components/estatisticas/EstatisticaCard';

const u = (id: string, nome: string) => ({ id, nome, avatarUrl: null });

describe('EstatisticaCard', () => {
  it('renderiza título, legenda, usuários e valor', () => {
    render(
      <EstatisticaCard
        icone="👑"
        titulo="Rei da liderança"
        legenda="Rodadas terminadas em 1º lugar"
        destaque={{ usuarios: [u('u1', 'Ana')], valor: '4 rodadas' }}
      />,
    );
    expect(screen.getByText('Rei da liderança')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('4 rodadas')).toBeInTheDocument();
    expect(screen.getByText('Rodadas terminadas em 1º lugar')).toBeInTheDocument();
  });

  it('mostra até 3 empatados e resume o excedente', () => {
    render(
      <EstatisticaCard
        icone="🏅"
        titulo="Top 5"
        legenda="x"
        destaque={{
          usuarios: [u('a', 'Ana'), u('b', 'Bia'), u('c', 'Caio'), u('d', 'Duda')],
          valor: '3',
        }}
      />,
    );
    expect(screen.getByText('Caio')).toBeInTheDocument();
    expect(screen.queryByText('Duda')).not.toBeInTheDocument();
    expect(screen.getByText('e mais 1')).toBeInTheDocument();
  });

  it('renderiza linha com texto no lugar de usuários e linhas secundárias', () => {
    render(
      <EstatisticaCard
        icone="🦓"
        titulo="A zebra da Copa"
        legenda="x"
        destaque={{ texto: 'Brasil x França', valor: '12%' }}
        secundarios={[{ texto: 'Empates reais', valor: '18%' }]}
      />,
    );
    expect(screen.getByText('Brasil x França')).toBeInTheDocument();
    expect(screen.getByText('Empates reais')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd apps/frontend; pnpm test -- EstatisticaCard`
Expected: FAIL — módulo não encontrado

- [ ] **Step 4: Implementar o card**

```tsx
// apps/frontend/src/components/estatisticas/EstatisticaCard.tsx
import type { UsuarioRef } from '@/types/api';

export type CardLinha = {
  usuarios?: UsuarioRef[];
  texto?: string;
  valor: string;
};

const MAX_NOMES = 3;

function Linha({ linha, principal = false }: { linha: CardLinha; principal?: boolean }) {
  const visiveis = (linha.usuarios ?? []).slice(0, MAX_NOMES);
  const extras = (linha.usuarios?.length ?? 0) - visiveis.length;
  const classeNome = principal ? 'text-sm font-medium' : 'text-xs text-gray-400';
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
        {linha.texto && <span className={`${classeNome} truncate`}>{linha.texto}</span>}
        {visiveis.map((u) => (
          <span key={u.id} className="flex items-center gap-1 min-w-0">
            {u.avatarUrl && <img src={u.avatarUrl} alt="" className="w-4 h-4 rounded-full" />}
            <span className={`${classeNome} truncate`}>{u.nome}</span>
          </span>
        ))}
        {extras > 0 && <span className="text-xs text-trovao-muted">e mais {extras}</span>}
      </div>
      <span className={principal ? 'text-base font-bold text-yellow-400 shrink-0' : 'text-xs text-gray-400 shrink-0'}>
        {linha.valor}
      </span>
    </div>
  );
}

export function EstatisticaCard({ icone, titulo, legenda, destaque, secundarios }: {
  icone: string;
  titulo: string;
  legenda: string;
  destaque: CardLinha;
  secundarios?: CardLinha[];
}) {
  return (
    <div className="bg-gray-800/60 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span aria-hidden>{icone}</span>
        <h3 className="text-sm font-semibold">{titulo}</h3>
      </div>
      <Linha linha={destaque} principal />
      {secundarios?.map((l, i) => <Linha key={i} linha={l} />)}
      <p className="text-xs text-trovao-muted">{legenda}</p>
    </div>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd apps/frontend; pnpm test -- EstatisticaCard`
Expected: PASS (3 testes)

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/types/api.ts apps/frontend/src/components/estatisticas apps/frontend/src/__tests__/EstatisticaCard.test.tsx
git commit -m "feat(estatistica): tipos do payload e card generico no frontend"
```

---

### Task 9: Frontend — PlacaresChart e AproveitamentoFases

**Files:**
- Create: `apps/frontend/src/components/estatisticas/PlacaresChart.tsx`
- Create: `apps/frontend/src/components/estatisticas/AproveitamentoFases.tsx`
- Test: `apps/frontend/src/__tests__/PlacaresChart.test.tsx`
- Test: `apps/frontend/src/__tests__/AproveitamentoFases.test.tsx`

- [ ] **Step 1: Escrever os testes falhando**

```tsx
// apps/frontend/src/__tests__/PlacaresChart.test.tsx
import { render } from '@testing-library/react';
import { PlacaresChart } from '@/components/estatisticas/PlacaresChart';

// Recharts usa ResizeObserver e dimensões; mockar para jsdom (mesmo padrão de RankingEvolucao).
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  } as any;
});

describe('PlacaresChart', () => {
  it('não renderiza nada sem dados', () => {
    const { container } = render(<PlacaresChart dados={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza o gráfico quando há placares', () => {
    const { container, getByText } = render(
      <PlacaresChart dados={[{ placar: '2x1', quantidade: 40 }, { placar: '1x0', quantidade: 25 }]} />,
    );
    expect(getByText(/placares mais apostados/i)).toBeInTheDocument();
    expect(container.querySelector('.recharts-responsive-container')).toBeTruthy();
  });
});
```

```tsx
// apps/frontend/src/__tests__/AproveitamentoFases.test.tsx
import { render, screen } from '@testing-library/react';
import { AproveitamentoFases } from '@/components/estatisticas/AproveitamentoFases';

describe('AproveitamentoFases', () => {
  it('não renderiza nada sem fases', () => {
    const { container } = render(<AproveitamentoFases fases={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza fase com rótulo amigável, aproveitamento e melhor da fase', () => {
    render(
      <AproveitamentoFases
        fases={[
          {
            fase: 'GRUPOS',
            aproveitamento: 42,
            melhor: { usuarios: [{ id: 'u1', nome: 'Ana', avatarUrl: null }], pontos: 120 },
          },
          { fase: 'OITAVAS', aproveitamento: 30, melhor: null },
        ]}
      />,
    );
    expect(screen.getByText('Grupos')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText(/Ana/)).toBeInTheDocument();
    expect(screen.getByText('Oitavas')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/frontend; pnpm test -- "PlacaresChart|AproveitamentoFases"`
Expected: FAIL — módulos não encontrados

- [ ] **Step 3: Implementar os dois componentes**

```tsx
// apps/frontend/src/components/estatisticas/PlacaresChart.tsx
'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

export function PlacaresChart({ dados }: { dados: Array<{ placar: string; quantidade: number }> }) {
  if (dados.length === 0) return null;
  return (
    <div className="bg-gray-800/60 rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-2">🎲 Placares mais apostados</h3>
      <div style={{ height: dados.length * 32 + 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 32 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="placar"
              width={40}
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Bar
              dataKey="quantidade"
              fill="#facc15"
              radius={[0, 4, 4, 0]}
              label={{ position: 'right', fill: '#e5e7eb', fontSize: 12 }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-trovao-muted mt-1">Palpites do bolão em jogos publicados</p>
    </div>
  );
}
```

```tsx
// apps/frontend/src/components/estatisticas/AproveitamentoFases.tsx
import type { UsuarioRef } from '@/types/api';

const ROTULOS: Record<string, string> = {
  GRUPOS: 'Grupos',
  SEGUNDA_FASE: '2ª fase',
  OITAVAS: 'Oitavas',
  QUARTAS: 'Quartas',
  SEMIS: 'Semis',
  TERCEIRO_LUGAR: '3º lugar',
  FINAL: 'Final',
};

type Fase = {
  fase: string;
  aproveitamento: number;
  melhor: { usuarios: UsuarioRef[]; pontos: number } | null;
};

export function AproveitamentoFases({ fases }: { fases: Fase[] }) {
  if (fases.length === 0) return null;
  return (
    <div className="bg-gray-800/60 rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-2">📊 Aproveitamento por fase</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-trovao-muted text-left">
            <th className="font-normal pb-1">Fase</th>
            <th className="font-normal pb-1 text-right">Bolão</th>
            <th className="font-normal pb-1 text-right">Melhor da fase</th>
          </tr>
        </thead>
        <tbody>
          {fases.map((f) => (
            <tr key={f.fase} className="border-t border-gray-700/60">
              <td className="py-1.5">{ROTULOS[f.fase] ?? f.fase}</td>
              <td className="py-1.5 text-right font-medium text-yellow-400">{f.aproveitamento}%</td>
              <td className="py-1.5 text-right text-gray-300">
                {f.melhor
                  ? `${f.melhor.usuarios.map((u) => u.nome).join(', ')} (${f.melhor.pontos} pts)`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-trovao-muted mt-1">
        Pontos do bolão ÷ máximo possível (placar exato × peso) em cada fase
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/frontend; pnpm test -- "PlacaresChart|AproveitamentoFases"`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/estatisticas apps/frontend/src/__tests__
git commit -m "feat(estatistica): grafico de placares e tabela de aproveitamento por fase"
```

---

### Task 10: Frontend — página de estatísticas

**Files:**
- Create: `apps/frontend/src/app/(app)/boloes/[id]/estatisticas/page.tsx`
- Test: `apps/frontend/src/__tests__/EstatisticasPage.test.tsx`

- [ ] **Step 1: Escrever o teste falhando**

```tsx
// apps/frontend/src/__tests__/EstatisticasPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EstatisticasPage from '@/app/(app)/boloes/[id]/estatisticas/page';
import { api } from '@/lib/api';
import type { EstatisticasBolao } from '@/types/api';

jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'bolao-1' }) }));
jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  } as any;
});

const apiGet = api.get as jest.Mock;
const u = (id: string, nome: string) => ({ id, nome, avatarUrl: null });

const payload: EstatisticasBolao = {
  temDados: true,
  ultimaPublicacao: { numero: 3, publicadoEm: '2026-06-28T12:00:00Z' },
  posicoes: {
    reiDaLideranca: [{ valor: 2, usuarios: [u('u1', 'Ana')] }],
    lanterna: [],
    foguete: { valor: 7, registros: [{ usuario: u('u2', 'Bruno'), publicacao: 2 }] },
    quedaLivre: null,
    maisRegular: null,
    top5: [],
  },
  recordes: {
    maiorPontuacaoRodada: null,
    rodadaGenerosa: { publicacao: 2, media: 14 },
    rodadaAvara: { publicacao: 1, media: 7.5 },
    reiDoPlacarExato: [],
    aproveitamentoPorFase: [],
  },
  palpites: {
    placaresMaisApostados: [{ placar: '2x1', quantidade: 40 }],
    jogoConsensual: null,
    jogoDividido: null,
    otimista: null,
    pessimista: null,
    mediaRealGols: null,
    ultimaHora: null,
    precavido: null,
    reenvios: [],
    empates: { percentualApostas: 12, percentualJogos: 18 },
    esquecidos: [],
  },
  zebras: {
    zebra: { jogo: 'A x B', percentualPontuaram: 10 },
    previsivel: null,
    acertosSolitarios: [{ jogo: 'C x D', usuario: u('u1', 'Ana'), placar: '3x2' }],
  },
};

function mockRespostas(estatisticas: unknown) {
  apiGet.mockImplementation((path: string) =>
    path.includes('estatisticas')
      ? Promise.resolve(estatisticas)
      : Promise.resolve({ id: 'bolao-1', nome: 'Bolão da Firma' }),
  );
}

describe('EstatisticasPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renderiza seções e cards com dados', async () => {
    mockRespostas(payload);
    render(<EstatisticasPage />);
    expect(await screen.findByText(/Posições/)).toBeInTheDocument();
    expect(screen.getByText('Bolão da Firma')).toBeInTheDocument();
    expect(screen.getByText(/dados até a rodada 3/i)).toBeInTheDocument();
    expect(screen.getByText('Rei da liderança')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText(/zebra da copa/i)).toBeInTheDocument();
  });

  it('omite cards nulos', async () => {
    mockRespostas(payload);
    render(<EstatisticasPage />);
    await screen.findByText(/Posições/);
    expect(screen.queryByText(/queda livre/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mais regular/i)).not.toBeInTheDocument();
  });

  it('mostra estado vazio quando temDados é false', async () => {
    mockRespostas({ temDados: false });
    render(<EstatisticasPage />);
    expect(
      await screen.findByText(/aparecem após a primeira rodada publicada/i),
    ).toBeInTheDocument();
  });

  it('mostra erro com retry e refaz a busca ao clicar', async () => {
    apiGet.mockRejectedValue(new Error('boom'));
    render(<EstatisticasPage />);
    const botao = await screen.findByRole('button', { name: /tentar novamente/i });
    mockRespostas(payload);
    await userEvent.click(botao);
    await waitFor(() => expect(screen.getByText('Rei da liderança')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/frontend; pnpm test -- EstatisticasPage`
Expected: FAIL — módulo da página não encontrado

- [ ] **Step 3: Implementar a página**

```tsx
// apps/frontend/src/app/(app)/boloes/[id]/estatisticas/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EstatisticaCard, CardLinha } from '@/components/estatisticas/EstatisticaCard';
import { PlacaresChart } from '@/components/estatisticas/PlacaresChart';
import { AproveitamentoFases } from '@/components/estatisticas/AproveitamentoFases';
import type { Bolao, EstatisticasBolao, RecordeRodada, TopEntry } from '@/types/api';

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-400 mb-3">{titulo}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

/** Card para rankings top-3 (linhas de TopEntry). */
function CardTop({ icone, titulo, legenda, entries, sufixo }: {
  icone: string; titulo: string; legenda: string; entries: TopEntry[]; sufixo: string;
}) {
  if (entries.length === 0) return null;
  const linha = (e: TopEntry): CardLinha => ({ usuarios: e.usuarios, valor: `${e.valor} ${sufixo}` });
  const [primeiro, ...resto] = entries;
  return (
    <EstatisticaCard icone={icone} titulo={titulo} legenda={legenda}
      destaque={linha(primeiro)} secundarios={resto.map(linha)} />
  );
}

/** Card para recordes ligados a uma rodada (RecordeRodada). */
function CardRecorde({ icone, titulo, legenda, recorde, formatarValor }: {
  icone: string; titulo: string; legenda: string;
  recorde: RecordeRodada | null; formatarValor: (valor: number) => string;
}) {
  if (!recorde || recorde.registros.length === 0) return null;
  const linha = (r: RecordeRodada['registros'][number]): CardLinha => ({
    usuarios: [r.usuario],
    valor: `${formatarValor(recorde.valor)} · rodada ${r.publicacao}`,
  });
  const [primeiro, ...resto] = recorde.registros;
  return (
    <EstatisticaCard icone={icone} titulo={titulo} legenda={legenda}
      destaque={linha(primeiro)} secundarios={resto.map(linha)} />
  );
}

function formatarAntecedencia(minutos: number): string {
  if (minutos < 60) return `${minutos} min antes`;
  if (minutos < 48 * 60) return `${Math.round(minutos / 60)}h antes`;
  return `${Math.round(minutos / (24 * 60))} dias antes`;
}

export default function EstatisticasPage() {
  const { id } = useParams<{ id: string }>();
  const [bolao, setBolao] = useState<Bolao | null>(null);
  const [dados, setDados] = useState<EstatisticasBolao | null>(null);
  const [erro, setErro] = useState(false);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(false);
    try {
      const [b, est] = await Promise.all([
        api.get<Bolao>(`/boloes/${id}`),
        api.get<EstatisticasBolao>(`/boloes/${id}/estatisticas`),
      ]);
      setBolao(b);
      setDados(est);
    } catch {
      setErro(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  if (loading) return <PageSkeleton />;
  if (erro || !dados) {
    return (
      <div className="text-center space-y-3 py-8">
        <p className="text-red-400">Não foi possível carregar as estatísticas.</p>
        <button onClick={carregar} className="text-sm underline text-trovao-muted hover:text-white">
          Tentar novamente
        </button>
      </div>
    );
  }

  const cabecalho = (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold">{bolao?.nome ?? 'Estatísticas'}</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Estatísticas{dados.temDados ? ` · dados até a rodada ${dados.ultimaPublicacao.numero}` : ''}
        </p>
      </div>
      <Link href={`/boloes/${id}`} className="text-trovao-muted text-sm hover:text-white shrink-0">
        ← Voltar
      </Link>
    </div>
  );

  if (!dados.temDados) {
    return (
      <div className="space-y-8">
        {cabecalho}
        <p className="text-trovao-muted text-sm">
          As estatísticas aparecem após a primeira rodada publicada.
        </p>
      </div>
    );
  }

  const { posicoes, recordes, palpites, zebras } = dados;

  return (
    <div className="space-y-8">
      {cabecalho}

      <Secao titulo="🏆 Posições">
        <CardTop icone="👑" titulo="Rei da liderança" legenda="Rodadas terminadas em 1º lugar"
          entries={posicoes.reiDaLideranca} sufixo="rodadas" />
        <CardTop icone="🔦" titulo="Lanterna" legenda="Rodadas terminadas em último lugar"
          entries={posicoes.lanterna} sufixo="rodadas" />
        <CardRecorde icone="🚀" titulo="Foguete da rodada" legenda="Maior subida de posições numa rodada"
          recorde={posicoes.foguete} formatarValor={(v) => `+${v} posições`} />
        <CardRecorde icone="🪂" titulo="Queda livre" legenda="Maior queda de posições numa rodada"
          recorde={posicoes.quedaLivre} formatarValor={(v) => `${v} posições`} />
        {posicoes.maisRegular && (
          <EstatisticaCard icone="📏" titulo="Mais regular"
            legenda="Menor oscilação de posição entre rodadas"
            destaque={{ usuarios: posicoes.maisRegular.usuarios, valor: `±${posicoes.maisRegular.valor}` }} />
        )}
        <CardTop icone="🏅" titulo="Frequência no top 5" legenda="Rodadas terminadas entre os 5 primeiros"
          entries={posicoes.top5} sufixo="rodadas" />
      </Secao>

      <Secao titulo="📈 Recordes">
        <CardRecorde icone="💥" titulo="Maior pontuação numa rodada" legenda="Recorde individual de pontos numa rodada"
          recorde={recordes.maiorPontuacaoRodada} formatarValor={(v) => `${v} pts`} />
        {recordes.rodadaGenerosa && recordes.rodadaAvara && (
          <EstatisticaCard icone="🎁" titulo="Rodada generosa vs avara"
            legenda="Maior e menor pontuação média do bolão"
            destaque={{ texto: `Rodada ${recordes.rodadaGenerosa.publicacao}`, valor: `${recordes.rodadaGenerosa.media} pts` }}
            secundarios={[{ texto: `Rodada ${recordes.rodadaAvara.publicacao}`, valor: `${recordes.rodadaAvara.media} pts` }]} />
        )}
        <CardTop icone="🎯" titulo="Rei do placar exato" legenda="Placares cravados até a última rodada"
          entries={recordes.reiDoPlacarExato} sufixo="placares" />
      </Secao>

      <AproveitamentoFases fases={recordes.aproveitamentoPorFase} />

      <Secao titulo="🎯 Palpites">
        {palpites.jogoConsensual && (
          <EstatisticaCard icone="🤝" titulo="Jogo mais consensual"
            legenda="Maior percentual de palpites no mesmo placar"
            destaque={{ texto: palpites.jogoConsensual.jogo, valor: `${palpites.jogoConsensual.percentual}% em ${palpites.jogoConsensual.placar}` }} />
        )}
        {palpites.jogoDividido && (
          <EstatisticaCard icone="🤯" titulo="Jogo mais dividido"
            legenda="Maior variedade de placares apostados"
            destaque={{ texto: palpites.jogoDividido.jogo, valor: `${palpites.jogoDividido.placaresDistintos} placares` }} />
        )}
        {palpites.otimista && palpites.pessimista && (
          <EstatisticaCard icone="⚖️" titulo="Otimistas vs pessimistas"
            legenda={`Média de gols apostados por jogo${palpites.mediaRealGols !== null ? ` · média real: ${palpites.mediaRealGols}` : ''}`}
            destaque={{ usuarios: palpites.otimista.usuarios, valor: `${palpites.otimista.mediaGols} gols` }}
            secundarios={[{ usuarios: palpites.pessimista.usuarios, valor: `${palpites.pessimista.mediaGols} gols` }]} />
        )}
        {palpites.ultimaHora && palpites.precavido && (
          <EstatisticaCard icone="⏰" titulo="Última hora vs precavido"
            legenda="Mediana da antecedência do palpite ao fechamento"
            destaque={{ usuarios: palpites.ultimaHora.usuarios, valor: formatarAntecedencia(palpites.ultimaHora.medianaMinutos) }}
            secundarios={[{ usuarios: palpites.precavido.usuarios, valor: formatarAntecedencia(palpites.precavido.medianaMinutos) }]} />
        )}
        <CardTop icone="🔁" titulo="Quem mais re-enviou palpites"
          legenda="Palpites re-enviados após o 1º envio (mesmo placar também conta)"
          entries={palpites.reenvios} sufixo="palpites" />
        {palpites.empates && (
          <EstatisticaCard icone="🫱🫲" titulo="Ninguém acredita em empate"
            legenda="Apostas em empate vs empates que aconteceram"
            destaque={{ texto: 'Apostas em empate', valor: `${palpites.empates.percentualApostas}%` }}
            secundarios={[{ texto: 'Empates reais', valor: `${palpites.empates.percentualJogos}%` }]} />
        )}
        <CardTop icone="🙈" titulo="Os mais esquecidos" legenda="Jogos publicados sem palpite enviado"
          entries={palpites.esquecidos} sufixo="jogos" />
      </Secao>

      <PlacaresChart dados={palpites.placaresMaisApostados} />

      <Secao titulo="🦓 Zebras">
        {zebras.zebra && (
          <EstatisticaCard icone="🦓" titulo="A zebra da Copa"
            legenda="Jogo em que menos gente pontuou"
            destaque={{ texto: zebras.zebra.jogo, valor: `${zebras.zebra.percentualPontuaram}% pontuaram` }} />
        )}
        {zebras.previsivel && (
          <EstatisticaCard icone="😴" titulo="Jogo mais previsível"
            legenda="Jogo em que mais gente pontuou"
            destaque={{ texto: zebras.previsivel.jogo, valor: `${zebras.previsivel.percentualPontuaram}% pontuaram` }} />
        )}
      </Secao>

      {zebras.acertosSolitarios.length > 0 && (
        <div className="bg-gray-800/60 rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-2">🎖️ Acertos solitários</h3>
          <div className="space-y-1.5">
            {zebras.acertosSolitarios.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5 min-w-0">
                  {a.usuario.avatarUrl && (
                    <img src={a.usuario.avatarUrl} alt="" className="w-4 h-4 rounded-full" />
                  )}
                  <span className="truncate">{a.usuario.nome}</span>
                </span>
                <span className="text-gray-400 text-xs shrink-0">
                  {a.jogo} · <span className="text-yellow-400 font-medium">{a.placar}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-trovao-muted mt-2">Placares exatos que só uma pessoa do bolão cravou</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/frontend; pnpm test -- EstatisticasPage`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add "apps/frontend/src/app/(app)/boloes/[id]/estatisticas" apps/frontend/src/__tests__/EstatisticasPage.test.tsx
git commit -m "feat(estatistica): pagina de estatisticas do bolao"
```

---

### Task 11: Link de entrada na página do bolão

**Files:**
- Modify: `apps/frontend/src/app/(app)/boloes/[id]/page.tsx:55-63`

- [ ] **Step 1: Adicionar o link no cabeçalho da página do bolão**

No JSX do cabeçalho (bloco `<div className="flex items-center justify-between gap-4">`), adicionar o link de estatísticas antes do "← Voltar":

```tsx
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{bolao.nome}</h1>
          {bolao.descricao && <p className="text-gray-400 text-sm mt-0.5">{bolao.descricao}</p>}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <Link href={`/boloes/${id}/estatisticas`} className="text-trovao-muted text-sm hover:text-white">
            📊 Estatísticas
          </Link>
          <Link href="/boloes" className="text-trovao-muted text-sm hover:text-white">← Voltar</Link>
        </div>
      </div>
```

- [ ] **Step 2: Rodar a suíte do frontend (regressão)**

Run: `cd apps/frontend; pnpm test`
Expected: PASS (nenhum teste existente depende desse cabeçalho)

- [ ] **Step 3: Verificação visual**

Com `pnpm dev` no ar: abrir http://localhost:3000, entrar num bolão e conferir o link "📊 Estatísticas" e a página nova (estado vazio ou com dados, conforme o seed).

- [ ] **Step 4: Commit**

```bash
git add "apps/frontend/src/app/(app)/boloes/[id]/page.tsx"
git commit -m "feat(estatistica): link de estatisticas na pagina do bolao"
```

---

### Task 12: Teste E2E de API

**Files:**
- Create: `e2e/tests/estatisticas/estatisticas.api.spec.ts`

Pré-requisito: infra no ar (`pnpm dev:infra`) e banco `bolao_trovao_e2e` criado (ver README).

- [ ] **Step 1: Escrever o teste E2E**

```ts
// e2e/tests/estatisticas/estatisticas.api.spec.ts
import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado, BOLAO_GLOBAL_ID } from '../../api/client';
import { truncateDynamic } from '../../support/db';
import { newUser } from '../../data/factories';
import { jogoComApostasAbertas } from '../../support/time';
import { aguardarPontuacaoDraft } from '../../support/queue';

test.describe('Estatísticas do bolão (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('membro vê estatísticas após publicação; sem publicação retorna temDados false', async ({ adminApi }) => {
    const apostador = await criarUsuarioAutenticado(newUser('estat'));

    // Antes de qualquer publicação
    const antes = await apostador.ctx.get(`/boloes/${BOLAO_GLOBAL_ID}/estatisticas`);
    expect(antes.ok()).toBeTruthy();
    expect((await antes.json()).temDados).toBe(false);

    // Aposta + placar + publicação
    const jogo = await jogoComApostasAbertas();
    await apostador.ctx.post('/apostas', { data: { jogoId: jogo.id, placarCasa: 2, placarVisitante: 1 } });
    await adminApi.patch(`/jogos/${jogo.id}/placar`, { data: { placarCasa: 2, placarVisitante: 1 } });
    await aguardarPontuacaoDraft(adminApi, BOLAO_GLOBAL_ID, apostador.user.id);
    const pub = await adminApi.post('/admin/publicacoes');
    expect(pub.ok()).toBeTruthy();

    const res = await apostador.ctx.get(`/boloes/${BOLAO_GLOBAL_ID}/estatisticas`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.temDados).toBe(true);
    expect(body.ultimaPublicacao.numero).toBeGreaterThanOrEqual(1);
    expect(body.palpites.placaresMaisApostados[0].placar).toBe('2x1');
    expect(
      body.posicoes.reiDaLideranca.some((e: any) =>
        e.usuarios.some((u: any) => u.id === apostador.user.id),
      ),
    ).toBeTruthy();

    await apostador.ctx.dispose();
  });

  test('não-membro recebe 403', async ({ adminApi }) => {
    const intruso = await criarUsuarioAutenticado(newUser('intruso'));
    // O moderador vira membro automaticamente — precisa ser um usuário DIFERENTE do intruso.
    const moderador = await criarUsuarioAutenticado(newUser('moderador'));
    const criado = await adminApi.post('/boloes', {
      data: {
        nome: 'Bolão Privado Estatísticas',
        maxParticipantes: 10,
        moderadorId: moderador.user.id,
      },
    });
    expect(criado.ok()).toBeTruthy();
    const bolao = await criado.json();

    const res = await intruso.ctx.get(`/boloes/${bolao.id}/estatisticas`);
    expect(res.status()).toBe(403);

    await intruso.ctx.dispose();
    await moderador.ctx.dispose();
  });
});
```

- [ ] **Step 2: Rodar o teste**

Run: `cd e2e; npx playwright test tests/estatisticas/estatisticas.api.spec.ts --project=api`
Expected: PASS (2 testes)

Nota: `CreateBolaoDto` exige `nome`, `maxParticipantes` (múltiplo de 10) e `moderadorId`; o preço é derivado no service. O moderador informado vira membro do bolão — por isso o teste usa um usuário dedicado como moderador, distinto do `intruso`.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/estatisticas
git commit -m "test(estatistica): e2e do endpoint de estatisticas"
```

---

### Task 13: README, suíte completa e PR

**Files:**
- Modify: `README.md` (seção **Funcionalidades** e árvore em **Estrutura do monorepo**)

- [ ] **Step 1: Atualizar o README**

Na seção **Funcionalidades**, adicionar após o bullet "Gráfico de evolução":

```markdown
- **Estatísticas do bolão** — página por bolão (`/boloes/:id/estatisticas`) com 20 estatísticas e curiosidades calculadas sobre rodadas publicadas: rankings de posição (mais rodadas em 1º, lanterna, foguete/queda, regularidade, top 5), recordes de pontuação (melhor rodada individual, rodada generosa/avara, rei do placar exato, aproveitamento por fase), curiosidades de palpites (placar mais apostado, consenso/divisão, otimistas vs pessimistas, última hora vs precavido, re-envios, empates, esquecidos) e zebras (jogo menos/mais acertado, acertos solitários). O resultado é cacheado em memória por publicação — só a primeira visita após cada rodada publicada recalcula
```

Na árvore da **Estrutura do monorepo**, adicionar abaixo de `│   │   │   ├── bolao/`:

```
│   │   │   ├── estatistica/ # Estatísticas por bolão (cache por publicação)
```

- [ ] **Step 2: Rodar a suíte completa**

Run (na raiz): `pnpm test`
Expected: PASS em todos os pacotes

Run: `cd apps/backend; pnpm exec tsc --noEmit`
Expected: sem erros

- [ ] **Step 3: Commit e PR**

```bash
git add README.md
git commit -m "docs: pagina de estatisticas do bolao no README"
git push -u origin feat/pagina-estatisticas
gh pr create --title "feat: pagina de estatisticas do bolao" --body "$(cat <<'EOF'
## Resumo
- Novo endpoint `GET /boloes/:bolaoId/estatisticas` (só membros; cache em memória por publicação)
- 20 estatísticas em 4 seções (posições, recordes, palpites, zebras), calculadas apenas sobre rodadas publicadas
- Página `/boloes/[id]/estatisticas` com cards, gráfico de placares (Recharts) e tabela de aproveitamento por fase
- Spec: docs/superpowers/specs/2026-07-02-pagina-estatisticas-design.md

## Testes
- Unit backend: calculadoras puras + service (cache, 403/404, temDados)
- Unit frontend: card, gráfico, tabela e página (estados vazio/erro)
- E2E API: fluxo publicação → estatísticas e 403 para não-membro

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
