# Ranking Rodada e Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar melhorias na aba Rodada do ranking, visibilidade de jogos encerrados, guard + confirmação na publicação admin, e busca client-side de usuários no admin.

**Architecture:** Mudanças incrementais sobre componentes existentes. Backend ganha duas rotas novas (pendentes da publicação e palpites por publicação×usuário). Frontend refina `EstadoAposta` (4→5 estados), adiciona componente de palpites no expand do `RankingRow`, modal de confirmação reusando `ui/dialog.tsx`, e filtro client-side simples na lista de usuários.

**Tech Stack:** NestJS 10, Prisma 5 (backend); Next.js 14, React 18, Tailwind, shadcn (frontend); Jest + Testing Library (testes).

**Spec:** `docs/superpowers/specs/2026-05-29-ranking-rodada-e-admin-design.md`

---

## Mapa de arquivos

### Backend

- `apps/backend/src/admin/admin.controller.ts` — adicionar `GET /admin/publicacoes/pendente`.
- `apps/backend/src/admin/admin.service.ts` — adicionar `listarPublicacaoPendente()`.
- `apps/backend/src/admin/admin.service.spec.ts` — testes do novo método.
- `apps/backend/src/publicacao/publicacao.service.ts` — refatorar `publicar` para usar a função extraída.
- `apps/backend/src/publicacao/publicacao.service.spec.ts` — ajustar mocks pós-refator.
- `apps/backend/src/ranking/ranking.controller.ts` — adicionar `GET /boloes/:bolaoId/ranking/publicacoes/:numero/usuarios/:usuarioId/apostas`.
- `apps/backend/src/ranking/ranking.service.ts` — método `palpitesDaRodada(bolaoId, numero, usuarioId)`.
- `apps/backend/src/ranking/ranking.service.spec.ts` — testes do novo método.

### Frontend (lib e tipos)

- `apps/frontend/src/types/api.ts` — tipos `JogoPendente`, `RodadaPalpiteItem`.
- `apps/frontend/src/lib/dataFormat.ts` (novo) — `formatDataPublicacao`.
- `apps/frontend/src/lib/jogoEstado.ts` — refinar `EstadoAposta` (4→5 estados) + atualizar `jogoNoFiltro`.

### Frontend (componentes)

- `apps/frontend/src/components/JogoCard.tsx` — visual por estado novo + badges.
- `apps/frontend/src/components/RankingPalpitesRodada.tsx` (novo) — lista enxuta de palpites.
- `apps/frontend/src/components/RankingRow.tsx` — prop `posicaoRodada?`, label `1ª (P 7ª)`, conteúdo do expand condicional.
- `apps/frontend/src/components/AdminPublicarDialog.tsx` (novo) — modal de confirmação.
- `apps/frontend/src/components/AdminRankingPreview.tsx` — guard + integração modal.

### Frontend (páginas)

- `apps/frontend/src/app/(app)/ranking/[bolaoId]/page.tsx` — calcular `posicaoRodada`, passar prop, label do select por data, linha auxiliar.
- `apps/frontend/src/app/admin/usuarios/page.tsx` — input + filtro client-side.

### Testes

- `apps/frontend/src/__tests__/RankingRow.test.tsx` — atualizar para nova prop `posicaoRodada` e expand condicional.
- `apps/frontend/src/__tests__/JogoCard.test.tsx` — cobrir novos estados/badges.
- `apps/frontend/src/__tests__/FiltroJogosChips.test.tsx` — verificar agrupamento `Encerrados`.
- `apps/frontend/src/__tests__/RankingPalpitesRodada.test.tsx` (novo) — render da lista.
- `apps/frontend/src/__tests__/AdminPublicarDialog.test.tsx` (novo).

### Documentação

- `README.md` — atualizar seções de publicação e ranking por rodada.

---

## Task 1: Backend — listarPublicacaoPendente

**Files:**
- Modify: `apps/backend/src/admin/admin.service.ts` — adicionar método.
- Modify: `apps/backend/src/admin/admin.controller.ts` — adicionar rota.
- Modify: `apps/backend/src/admin/admin.service.spec.ts` — testes.

- [ ] **Step 1: Escrever teste do novo método**

Em `apps/backend/src/admin/admin.service.spec.ts`, adicionar ao `prismaMock` (no objeto declarado nas linhas 9-15):

```ts
jogo: { findMany: jest.fn() },
```

E criar novo `describe` antes do `describe('atualizarUsuario'...)`:

```ts
describe('listarPublicacaoPendente', () => {
  it('retorna jogos com placar preenchido e sem publicação, ordenados por dataHora', async () => {
    const jogos = [
      { id: 'j1', dataHora: new Date('2026-06-11T16:00:00Z') },
      { id: 'j2', dataHora: new Date('2026-06-11T20:00:00Z') },
    ];
    prismaMock.jogo.findMany.mockResolvedValue(jogos);
    const r = await service.listarPublicacaoPendente();
    expect(r).toBe(jogos);
    expect(prismaMock.jogo.findMany).toHaveBeenCalledWith({
      where: { placarCasa: { not: null }, publicacaoId: null },
      orderBy: { dataHora: 'asc' },
      select: expect.objectContaining({
        id: true, dataHora: true, rodada: true, fase: true,
        pesoPontuacao: true, placarCasa: true, placarVisitante: true,
        selecaoCasa: expect.any(Object),
        selecaoVisitante: expect.any(Object),
      }),
    });
  });

  it('retorna lista vazia quando nada está pendente', async () => {
    prismaMock.jogo.findMany.mockResolvedValue([]);
    const r = await service.listarPublicacaoPendente();
    expect(r).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar o teste — deve falhar**

Run: `cd apps/backend && pnpm exec jest src/admin/admin.service.spec.ts -t "listarPublicacaoPendente"`
Expected: FAIL (`service.listarPublicacaoPendente is not a function`).

- [ ] **Step 3: Implementar `listarPublicacaoPendente` no service**

Em `apps/backend/src/admin/admin.service.ts`, adicionar antes de `resetarSenha`:

```ts
async listarPublicacaoPendente() {
  return this.prisma.jogo.findMany({
    where: { placarCasa: { not: null }, publicacaoId: null },
    orderBy: { dataHora: 'asc' },
    select: {
      id: true, dataHora: true, rodada: true, fase: true,
      pesoPontuacao: true, placarCasa: true, placarVisitante: true,
      selecaoCasa:      { select: { nome: true, codigo: true, bandeiraSvg: true } },
      selecaoVisitante: { select: { nome: true, codigo: true, bandeiraSvg: true } },
    },
  });
}
```

- [ ] **Step 4: Rodar o teste — deve passar**

Run: `cd apps/backend && pnpm exec jest src/admin/admin.service.spec.ts -t "listarPublicacaoPendente"`
Expected: PASS.

- [ ] **Step 5: Adicionar a rota no controller**

Em `apps/backend/src/admin/admin.controller.ts`, adicionar antes de `@Get('usuarios')`:

```ts
@Get('publicacoes/pendente')
listarPublicacaoPendente() {
  return this.service.listarPublicacaoPendente();
}
```

- [ ] **Step 6: Rodar full suite do backend**

Run: `cd apps/backend && pnpm exec jest`
Expected: PASS (todos).

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/admin/admin.controller.ts apps/backend/src/admin/admin.service.ts apps/backend/src/admin/admin.service.spec.ts
git commit -m "feat(backend): add GET /admin/publicacoes/pendente"
```

---

## Task 2: Backend — refatorar PublicacaoService para reusar critério

**Files:**
- Modify: `apps/backend/src/publicacao/publicacao.service.ts` — usar o critério de `AdminService.listarPublicacaoPendente`.
- Modify: `apps/backend/src/publicacao/publicacao.module.ts` — injetar `AdminService` se necessário.
- Modify: `apps/backend/src/publicacao/publicacao.service.spec.ts` — atualizar mocks.

> Decisão: extrair critério como método compartilhado **no `PublicacaoService` mesmo**, evitando dependência circular `Publicacao→Admin`. `AdminService.listarPublicacaoPendente` passa a delegar para `PublicacaoService.listarJogosPendentes()`.

- [ ] **Step 1: Escrever/ajustar teste do novo método em PublicacaoService**

Em `apps/backend/src/publicacao/publicacao.service.spec.ts`, adicionar dentro do `describe('PublicacaoService.publicar', ...)` (ou criar novo `describe` no mesmo arquivo):

```ts
describe('listarJogosPendentes', () => {
  it('retorna jogos com placar e sem publicacao, ordenados por dataHora', async () => {
    prismaMock.jogo.findMany.mockResolvedValue([{ id: 'j1' }]);
    const r = await service.listarJogosPendentes();
    expect(r).toEqual([{ id: 'j1' }]);
    expect(prismaMock.jogo.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { placarCasa: { not: null }, publicacaoId: null },
      orderBy: { dataHora: 'asc' },
    }));
  });
});
```

- [ ] **Step 2: Rodar o teste — deve falhar**

Run: `cd apps/backend && pnpm exec jest src/publicacao/publicacao.service.spec.ts -t "listarJogosPendentes"`
Expected: FAIL.

- [ ] **Step 3: Implementar `listarJogosPendentes` em PublicacaoService**

Em `apps/backend/src/publicacao/publicacao.service.ts`, adicionar método público (acima de `publicar`):

```ts
async listarJogosPendentes() {
  return this.prisma.jogo.findMany({
    where: { placarCasa: { not: null }, publicacaoId: null },
    orderBy: { dataHora: 'asc' },
    select: {
      id: true, dataHora: true, rodada: true, fase: true,
      pesoPontuacao: true, placarCasa: true, placarVisitante: true,
      selecaoCasa:      { select: { nome: true, codigo: true, bandeiraSvg: true } },
      selecaoVisitante: { select: { nome: true, codigo: true, bandeiraSvg: true } },
    },
  });
}
```

- [ ] **Step 4: Rodar o teste — deve passar**

Run: `cd apps/backend && pnpm exec jest src/publicacao/publicacao.service.spec.ts -t "listarJogosPendentes"`
Expected: PASS.

- [ ] **Step 5: AdminService delega a PublicacaoService**

Em `apps/backend/src/admin/admin.service.ts`, trocar a implementação adicionada no Task 1:

```ts
async listarPublicacaoPendente() {
  return this.publicacao.listarJogosPendentes();
}
```

Adicionar `PublicacaoService` no construtor:

```ts
import { PublicacaoService } from '../publicacao/publicacao.service';

constructor(
  private prisma: PrismaService,
  private ranking: RankingService,
  private publicacao: PublicacaoService,
  private jwt: JwtService,
  private config: ConfigService,
  @Inject('MAILER') private mailer: any,
) {}
```

- [ ] **Step 6: Ajustar AdminModule e AdminService.spec**

Em `apps/backend/src/admin/admin.module.ts`, importar `PublicacaoModule`:

```ts
import { PublicacaoModule } from '../publicacao/publicacao.module';

@Module({
  imports: [PrismaModule, RankingModule, PublicacaoModule, ConfigModule, /* outros existentes */],
  // ...
})
```

(Se `PublicacaoModule` ainda não exporta `PublicacaoService`, adicionar `exports: [PublicacaoService]` nele.)

Em `apps/backend/src/admin/admin.service.spec.ts`, substituir a expectativa de `prismaMock.jogo.findMany` no teste de `listarPublicacaoPendente` por delegação a `publicacaoMock.listarJogosPendentes`:

```ts
const publicacaoMock = { listarJogosPendentes: jest.fn() };

// adicionar provider:
{ provide: PublicacaoService, useValue: publicacaoMock },

// substituir o teste:
describe('listarPublicacaoPendente', () => {
  it('delega para publicacao.listarJogosPendentes', async () => {
    publicacaoMock.listarJogosPendentes.mockResolvedValue([{ id: 'j1' }]);
    const r = await service.listarPublicacaoPendente();
    expect(r).toEqual([{ id: 'j1' }]);
    expect(publicacaoMock.listarJogosPendentes).toHaveBeenCalled();
  });
});
```

Remover `jogo: { findMany: jest.fn() }` do `prismaMock` se não for mais usado em outros testes do arquivo.

- [ ] **Step 7: Refatorar `publicar` para usar a função extraída (sem mudança de comportamento)**

Em `apps/backend/src/publicacao/publicacao.service.ts`, dentro do método `publicar`, substituir:

```ts
await this.prisma.jogo.updateMany({
  where: { placarCasa: { not: null }, publicacaoId: null },
  data: { publicacaoId: publicacao.id },
});

const jogosRodada = await this.prisma.jogo.findMany({
  where: { publicacaoId: publicacao.id },
  select: { id: true },
});
```

por:

```ts
const pendentes = await this.listarJogosPendentes();
const idsPendentes = pendentes.map((j) => j.id);

await this.prisma.jogo.updateMany({
  where: { id: { in: idsPendentes } },
  data: { publicacaoId: publicacao.id },
});

const jogosRodada = pendentes.map((j) => ({ id: j.id }));
```

- [ ] **Step 8: Atualizar spec do PublicacaoService.publicar**

Em `apps/backend/src/publicacao/publicacao.service.spec.ts`, no `beforeEach` de `publicar`, garantir que `prismaMock.jogo.findMany` retorne os jogos pendentes (a chamada agora vem antes do `updateMany`). Se já mocka `[{ id: 'j1' }]`, manter. Ajustar a expectativa de `updateMany` para `where: { id: { in: ['j1'] } }`:

```ts
expect(prismaMock.jogo.updateMany).toHaveBeenCalledWith({
  where: { id: { in: ['j1'] } },
  data: { publicacaoId: 'pub-3' },
});
```

- [ ] **Step 9: Rodar full suite do backend**

Run: `cd apps/backend && pnpm exec jest`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/backend/src/admin apps/backend/src/publicacao
git commit -m "refactor(backend): share pending-games criterion between publicar and admin"
```

---

## Task 3: Backend — endpoint de palpites da rodada por usuário

**Files:**
- Modify: `apps/backend/src/ranking/ranking.service.ts` — adicionar `palpitesDaRodada(bolaoId, numero, usuarioId)`.
- Modify: `apps/backend/src/ranking/ranking.controller.ts` — adicionar rota.
- Modify: `apps/backend/src/ranking/ranking.service.spec.ts` — testes.

- [ ] **Step 1: Escrever teste do método novo**

Em `apps/backend/src/ranking/ranking.service.spec.ts`, adicionar um `describe('palpitesDaRodada', ...)` (criar `prismaMock` extras se necessário — `publicacao.findUnique`, `jogo.findMany`, `aposta.findMany`):

```ts
describe('palpitesDaRodada', () => {
  it('retorna jogos da publicação com palpites (ou null) e pontuação', async () => {
    prismaMock.publicacao.findUnique.mockResolvedValue({ id: 'pub-3', numero: 3 });
    prismaMock.jogo.findMany.mockResolvedValue([
      {
        id: 'j1', dataHora: new Date('2026-06-11T16:00:00Z'),
        pesoPontuacao: 2, placarCasa: 2, placarVisitante: 1,
        selecaoCasa:      { nome: 'Brasil',    codigo: 'BRA', bandeiraSvg: '<svg></svg>' },
        selecaoVisitante: { nome: 'Argentina', codigo: 'ARG', bandeiraSvg: '<svg></svg>' },
      },
      {
        id: 'j2', dataHora: new Date('2026-06-11T20:00:00Z'),
        pesoPontuacao: 1, placarCasa: 0, placarVisitante: 0,
        selecaoCasa:      { nome: 'Espanha', codigo: 'ESP', bandeiraSvg: '<svg></svg>' },
        selecaoVisitante: { nome: 'Portugal', codigo: 'POR', bandeiraSvg: '<svg></svg>' },
      },
    ]);
    prismaMock.aposta.findMany.mockResolvedValue([
      { jogoId: 'j1', placarCasa: 2, placarVisitante: 1, pontuacao: 12 },
      // j2 sem aposta
    ]);

    const r = await service.palpitesDaRodada('b1', 3, 'u1');
    expect(prismaMock.publicacao.findUnique).toHaveBeenCalledWith({ where: { numero: 3 } });
    expect(prismaMock.jogo.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { publicacaoId: 'pub-3' },
      orderBy: { dataHora: 'asc' },
    }));
    expect(prismaMock.aposta.findMany).toHaveBeenCalledWith({
      where: { usuarioId: 'u1', jogoId: { in: ['j1', 'j2'] } },
      select: { jogoId: true, placarCasa: true, placarVisitante: true, pontuacao: true },
    });
    expect(r).toEqual([
      {
        jogo: expect.objectContaining({ id: 'j1', pesoPontuacao: 2 }),
        palpite: { placarCasa: 2, placarVisitante: 1 },
        pontuacao: 12,
      },
      {
        jogo: expect.objectContaining({ id: 'j2' }),
        palpite: null,
        pontuacao: 0,
      },
    ]);
  });

  it('retorna lista vazia se publicação não existe', async () => {
    prismaMock.publicacao.findUnique.mockResolvedValue(null);
    const r = await service.palpitesDaRodada('b1', 99, 'u1');
    expect(r).toEqual([]);
  });
});
```

Atenção: garantir que `prismaMock` no spec inclua `publicacao: { findUnique: jest.fn() }`, `jogo: { findMany: jest.fn() }` e `aposta: { findMany: jest.fn() }`. Se já existirem, só reaproveitar.

- [ ] **Step 2: Rodar o teste — deve falhar**

Run: `cd apps/backend && pnpm exec jest src/ranking/ranking.service.spec.ts -t "palpitesDaRodada"`
Expected: FAIL.

- [ ] **Step 3: Implementar `palpitesDaRodada` no service**

Em `apps/backend/src/ranking/ranking.service.ts`, adicionar abaixo de `evolucao`:

```ts
async palpitesDaRodada(bolaoId: string, numero: number, usuarioId: string) {
  // bolaoId é mantido para autorização futura/symmetry; visibilidade segue padrão das apostas.
  const publicacao = await this.prisma.publicacao.findUnique({ where: { numero } });
  if (!publicacao) return [];

  const jogos = await this.prisma.jogo.findMany({
    where: { publicacaoId: publicacao.id },
    orderBy: { dataHora: 'asc' },
    select: {
      id: true, dataHora: true, pesoPontuacao: true,
      placarCasa: true, placarVisitante: true,
      selecaoCasa:      { select: { nome: true, codigo: true, bandeiraSvg: true } },
      selecaoVisitante: { select: { nome: true, codigo: true, bandeiraSvg: true } },
    },
  });
  if (jogos.length === 0) return [];

  const apostas = await this.prisma.aposta.findMany({
    where: { usuarioId, jogoId: { in: jogos.map((j) => j.id) } },
    select: { jogoId: true, placarCasa: true, placarVisitante: true, pontuacao: true },
  });
  const apostaPorJogo = new Map(apostas.map((a) => [a.jogoId, a]));

  return jogos.map((jogo) => {
    const a = apostaPorJogo.get(jogo.id);
    return {
      jogo,
      palpite: a ? { placarCasa: a.placarCasa, placarVisitante: a.placarVisitante } : null,
      pontuacao: a?.pontuacao ?? 0,
    };
  });
}
```

- [ ] **Step 4: Rodar o teste — deve passar**

Run: `cd apps/backend && pnpm exec jest src/ranking/ranking.service.spec.ts -t "palpitesDaRodada"`
Expected: PASS.

- [ ] **Step 5: Adicionar a rota no controller**

Em `apps/backend/src/ranking/ranking.controller.ts`, adicionar abaixo de `evolucao`:

```ts
@Get('publicacoes/:numero/usuarios/:usuarioId/apostas')
palpitesDaRodada(
  @Param('bolaoId') bolaoId: string,
  @Param('numero') numero: string,
  @Param('usuarioId') usuarioId: string,
) {
  return this.service.palpitesDaRodada(bolaoId, Number(numero), usuarioId);
}
```

- [ ] **Step 6: Rodar full suite do backend**

Run: `cd apps/backend && pnpm exec jest`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/ranking
git commit -m "feat(backend): add palpites-da-rodada endpoint for ranking expand"
```

---

## Task 4: Frontend — formatador de data de publicação

**Files:**
- Create: `apps/frontend/src/lib/dataFormat.ts`.
- Create: `apps/frontend/src/__tests__/dataFormat.test.ts`.

- [ ] **Step 1: Escrever o teste**

`apps/frontend/src/__tests__/dataFormat.test.ts`:

```ts
import { formatDataPublicacao } from '@/lib/dataFormat';

it('formata ISO em dd/mm/yyyy', () => {
  // Construir Date local pra evitar diferença de timezone:
  const d = new Date(2026, 4 /* maio */, 26, 10, 0, 0);
  expect(formatDataPublicacao(d.toISOString())).toBe('26/05/2026');
});

it('pad zero em dia/mês', () => {
  const d = new Date(2026, 0, 3);
  expect(formatDataPublicacao(d.toISOString())).toBe('03/01/2026');
});
```

- [ ] **Step 2: Rodar o teste — deve falhar**

Run: `cd apps/frontend && pnpm test -- dataFormat.test`
Expected: FAIL (`Cannot find module '@/lib/dataFormat'`).

- [ ] **Step 3: Implementar**

`apps/frontend/src/lib/dataFormat.ts`:

```ts
export function formatDataPublicacao(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
```

- [ ] **Step 4: Rodar o teste — deve passar**

Run: `cd apps/frontend && pnpm test -- dataFormat.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/lib/dataFormat.ts apps/frontend/src/__tests__/dataFormat.test.ts
git commit -m "feat(frontend): add formatDataPublicacao helper"
```

---

## Task 5: Frontend — refinar EstadoAposta (4 → 5 estados)

**Files:**
- Modify: `apps/frontend/src/lib/jogoEstado.ts`.
- Modify: `apps/frontend/src/__tests__/FiltroJogosChips.test.tsx` (se cobrir filtros) — verificar suíte ainda passa.

- [ ] **Step 1: Adicionar teste pro novo estado em `lib/jogoEstado` (caso não exista um arquivo de teste dedicado)**

Criar `apps/frontend/src/__tests__/jogoEstado.test.ts`:

```ts
import { getEstadoAposta, jogoNoFiltro } from '@/lib/jogoEstado';
import type { Jogo, Aposta } from '@/types/api';

const HORA_FUTURA = new Date(Date.now() + 3600_000).toISOString();
const HORA_PASSADA = new Date(Date.now() - 3600_000).toISOString();

const baseJogo: Jogo = {
  id: 'j1', dataHora: HORA_FUTURA, rodada: 1, grupo: null, fase: 'GRUPOS',
  placarCasa: null, placarVisitante: null, pesoPontuacao: 1,
  selecaoCasa: { id: 'b', nome: 'B', codigo: 'BRA', bandeiraSvg: '' },
  selecaoVisitante: { id: 'a', nome: 'A', codigo: 'ARG', bandeiraSvg: '' },
};

const baseAposta: Aposta = {
  id: 'a1', jogoId: 'j1', placarCasa: 2, placarVisitante: 1,
  pontuacao: null, atualizadoEm: new Date().toISOString(), jogo: baseJogo,
};

it('aberto: prazo aberto, sem aposta', () => {
  expect(getEstadoAposta(baseJogo)).toBe('aberto');
});

it('salvo: prazo aberto, com aposta', () => {
  expect(getEstadoAposta(baseJogo, baseAposta)).toBe('salvo');
});

it('sem-palpite: prazo encerrado, sem aposta', () => {
  expect(getEstadoAposta({ ...baseJogo, dataHora: HORA_PASSADA })).toBe('sem-palpite');
});

it('finalizado: prazo encerrado, com placar, com aposta', () => {
  const j = { ...baseJogo, dataHora: HORA_PASSADA, placarCasa: 1, placarVisitante: 0 };
  expect(getEstadoAposta(j, { ...baseAposta, jogo: j })).toBe('finalizado');
});

it('aguardando: prazo encerrado, sem placar, com aposta', () => {
  const j = { ...baseJogo, dataHora: HORA_PASSADA };
  expect(getEstadoAposta(j, baseAposta)).toBe('aguardando');
});

it('filtro Encerrados inclui aguardando, finalizado, sem-palpite', () => {
  expect(jogoNoFiltro('aguardando', 'Encerrados')).toBe(true);
  expect(jogoNoFiltro('finalizado', 'Encerrados')).toBe(true);
  expect(jogoNoFiltro('sem-palpite', 'Encerrados')).toBe(true);
  expect(jogoNoFiltro('aberto', 'Encerrados')).toBe(false);
  expect(jogoNoFiltro('salvo', 'Encerrados')).toBe(false);
});
```

- [ ] **Step 2: Rodar o teste — deve falhar**

Run: `cd apps/frontend && pnpm test -- jogoEstado.test`
Expected: FAIL (estados `aguardando` / `finalizado` / `sem-palpite` ainda não existem).

- [ ] **Step 3: Refinar `lib/jogoEstado.ts`**

Substituir o conteúdo de `apps/frontend/src/lib/jogoEstado.ts`:

```ts
import type { Jogo, Aposta } from '@/types/api';
import { MINUTOS_PRAZO_APOSTA } from '@bolao/shared';

export type EstadoAposta =
  | 'aberto' | 'salvo' | 'aguardando' | 'finalizado' | 'sem-palpite';

export type FiltroJogo = 'Todos' | 'Pendentes' | 'Apostados' | 'Encerrados';

export function prazoEncerrado(jogo: Jogo): boolean {
  const prazo = new Date(jogo.dataHora).getTime() - MINUTOS_PRAZO_APOSTA * 60 * 1000;
  return Date.now() >= prazo;
}

export function getEstadoAposta(jogo: Jogo, aposta?: Aposta): EstadoAposta {
  const prazo = prazoEncerrado(jogo);
  const temPlacar = jogo.placarCasa !== null && jogo.placarVisitante !== null;
  if (!prazo && !aposta) return 'aberto';
  if (!prazo && aposta)  return 'salvo';
  if (!aposta)           return 'sem-palpite';
  if (temPlacar)         return 'finalizado';
  return 'aguardando';
}

export function jogoNoFiltro(estado: EstadoAposta, filtro: FiltroJogo): boolean {
  switch (filtro) {
    case 'Todos':      return true;
    case 'Pendentes':  return estado === 'aberto';
    case 'Apostados':  return estado === 'salvo';
    case 'Encerrados': return estado === 'aguardando' || estado === 'finalizado' || estado === 'sem-palpite';
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

- [ ] **Step 4: Rodar testes — devem passar**

Run: `cd apps/frontend && pnpm test -- jogoEstado.test`
Expected: PASS.

- [ ] **Step 5: Rodar typecheck — vai quebrar no JogoCard**

Run: `cd apps/frontend && pnpm exec tsc --noEmit`
Expected: FAIL em `JogoCard.tsx` porque o `ESTADO_BORDER` ainda tem chaves antigas (`incompleto`, `fechado`). Esse erro é resolvido na Task 6. Não comitar ainda — fazer a Task 6 em sequência.

> Nota: o repo segue padrão TDD com commits frequentes, mas trocar a `union` quebra `JogoCard.tsx` por causa do `Record<EstadoAposta, ...>`. Optamos por agrupar Task 5 + Task 6 num único commit no fim da Task 6 para evitar commit que não tipa.

---

## Task 6: Frontend — JogoCard novo visual

**Files:**
- Modify: `apps/frontend/src/components/JogoCard.tsx`.
- Modify: `apps/frontend/src/__tests__/JogoCard.test.tsx`.

- [ ] **Step 1: Atualizar testes do JogoCard**

Em `apps/frontend/src/__tests__/JogoCard.test.tsx`, substituir os testes `'incompleto — sem botão, sem texto "prazo encerrado"'` e `'fechado com resultado — rodapé "Placar" com placar real e pontuação'` por estes (e adicionar dois novos):

```ts
it('sem-palpite — badge "Sem palpite" e card atenuado', () => {
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_PASSADA }} onApostar={jest.fn()} />);
  expect(screen.getByText(/sem palpite/i)).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('aguardando — badge "Aguardando placar" quando há aposta mas não há placar', () => {
  const jogo = { ...jogoBase, dataHora: HORA_PASSADA };
  render(<JogoCard jogo={jogo} aposta={{ ...apostaExemplo, jogo }} onApostar={jest.fn()} />);
  expect(screen.getByText(/aguardando placar/i)).toBeInTheDocument();
});

it('finalizado — rodapé "Placar" com placar real e pontuação, opacidade 100%', () => {
  const jogoComPlacar = { ...jogoBase, dataHora: HORA_PASSADA, placarCasa: 1, placarVisitante: 1 };
  const apostaPontuada = { ...apostaExemplo, jogo: jogoComPlacar, pontuacao: 5 };
  const { container } = render(<JogoCard jogo={jogoComPlacar} aposta={apostaPontuada} onApostar={jest.fn()} />);
  expect(screen.getByText('Placar:')).toBeInTheDocument();
  expect(screen.getByText('1 × 1')).toBeInTheDocument();
  expect(screen.getByText('+5 pts')).toBeInTheDocument();
  // não deve estar com opacity-60 / opacity-85 no card raiz
  const card = container.firstChild as HTMLElement;
  expect(card.className).not.toMatch(/opacity-60|opacity-85/);
});

it('finalizado com acerto — borda verde-clara', () => {
  const jogoComPlacar = { ...jogoBase, dataHora: HORA_PASSADA, placarCasa: 1, placarVisitante: 1 };
  const apostaPontuada = { ...apostaExemplo, jogo: jogoComPlacar, pontuacao: 5 };
  const { container } = render(<JogoCard jogo={jogoComPlacar} aposta={apostaPontuada} onApostar={jest.fn()} />);
  const card = container.firstChild as HTMLElement;
  expect(card.className).toMatch(/trovao-green/);
});
```

Deixar inalterados os testes de `aberto`, `salvo`, peso etc. Mas o teste `'sem resultado — não mostra rodapé "Placar"'` precisa receber `dataHora: HORA_FUTURA` (já recebe) — manter como está.

- [ ] **Step 2: Rodar testes — devem falhar**

Run: `cd apps/frontend && pnpm test -- JogoCard.test`
Expected: FAIL (badges/visual não existem ainda).

- [ ] **Step 3: Refatorar `JogoCard.tsx`**

Em `apps/frontend/src/components/JogoCard.tsx`, substituir:

```ts
const ESTADO_BORDER: Record<EstadoAposta, string> = {
  aberto:    'border-trovao-border hover:border-trovao-green/40',
  salvo:     'border-trovao-green',
  incompleto:'border-trovao-border opacity-60',
  fechado:   'border-trovao-border opacity-60',
};
```

por:

```ts
const ESTADO_BORDER: Record<EstadoAposta, string> = {
  aberto:        'border-trovao-border hover:border-trovao-green/40',
  salvo:         'border-trovao-green',
  aguardando:    'border-trovao-border opacity-85',
  finalizado:    'border-trovao-border',
  'sem-palpite': 'border-trovao-border opacity-85',
};

const ESTADO_BADGE: Partial<Record<EstadoAposta, string>> = {
  aguardando:    'Aguardando placar',
  'sem-palpite': 'Sem palpite',
};
```

No JSX, dentro do componente, calcular border final levando em conta acerto em `finalizado`:

```ts
const borderClass = estado === 'finalizado' && (aposta?.pontuacao ?? 0) > 0
  ? 'border-trovao-green/40'
  : ESTADO_BORDER[estado];
const badge = ESTADO_BADGE[estado];
```

Trocar `<div className={`bg-trovao-card border rounded-xl p-4 space-y-2 transition-colors ${ESTADO_BORDER[estado]}`}>` para usar `borderClass`.

No header, ao lado da hora (lines ~52-60), trocar o cluster `<div className="flex items-center gap-2 ...">` para:

```tsx
<div className="flex items-center gap-2 text-xs text-trovao-muted shrink-0">
  {palpitesHref && (
    <Link href={palpitesHref}
      className="text-trovao-gold text-[10px] font-bold hover:underline shrink-0">
      Palpites →
    </Link>
  )}
  <span title={`Esse jogo tem peso ×${jogo.pesoPontuacao}`}
    className={`cursor-help rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
      PESO_BADGE[jogo.pesoPontuacao] ?? PESO_BADGE[4]
    }`}>
    ×{jogo.pesoPontuacao}
  </span>
  {badge ? (
    <span className="rounded-full bg-trovao-surface px-2 py-0.5 text-[10px] font-semibold text-trovao-muted">
      {badge}
    </span>
  ) : (
    <span>{formatHora(jogo.dataHora)}</span>
  )}
</div>
```

No footer, aumentar a fonte do placar real:

```tsx
<span className="text-white font-mono font-semibold text-sm">
  {temResultado ? `${jogo.placarCasa} × ${jogo.placarVisitante}` : '—'}
</span>
```

- [ ] **Step 4: Rodar testes do JogoCard**

Run: `cd apps/frontend && pnpm test -- JogoCard.test`
Expected: PASS.

- [ ] **Step 5: Rodar typecheck**

Run: `cd apps/frontend && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Rodar full suite frontend**

Run: `cd apps/frontend && pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit (agrupado com Task 5)**

```bash
git add apps/frontend/src/lib/jogoEstado.ts apps/frontend/src/components/JogoCard.tsx apps/frontend/src/__tests__/jogoEstado.test.ts apps/frontend/src/__tests__/JogoCard.test.tsx
git commit -m "feat(frontend): split EstadoAposta into 5 states and surface finalizado/aguardando"
```

---

## Task 7: Frontend — tipos `JogoPendente` e `RodadaPalpiteItem`

**Files:**
- Modify: `apps/frontend/src/types/api.ts`.

- [ ] **Step 1: Adicionar tipos**

Em `apps/frontend/src/types/api.ts`, adicionar ao final:

```ts
export interface JogoPendente {
  id: string;
  dataHora: string;
  rodada: number;
  fase: string;
  pesoPontuacao: number;
  placarCasa: number;
  placarVisitante: number;
  selecaoCasa:      { nome: string; codigo: string; bandeiraSvg: string };
  selecaoVisitante: { nome: string; codigo: string; bandeiraSvg: string };
}

export interface RodadaPalpiteItem {
  jogo: {
    id: string;
    dataHora: string;
    pesoPontuacao: number;
    placarCasa: number;
    placarVisitante: number;
    selecaoCasa:      { nome: string; codigo: string; bandeiraSvg: string };
    selecaoVisitante: { nome: string; codigo: string; bandeiraSvg: string };
  };
  palpite: { placarCasa: number; placarVisitante: number } | null;
  pontuacao: number;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/frontend && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/types/api.ts
git commit -m "feat(frontend): add JogoPendente and RodadaPalpiteItem types"
```

---

## Task 8: Frontend — RankingPalpitesRodada

**Files:**
- Create: `apps/frontend/src/components/RankingPalpitesRodada.tsx`.
- Create: `apps/frontend/src/__tests__/RankingPalpitesRodada.test.tsx`.

- [ ] **Step 1: Escrever o teste do componente**

`apps/frontend/src/__tests__/RankingPalpitesRodada.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';
import { RankingPalpitesRodada } from '@/components/RankingPalpitesRodada';
import type { RodadaPalpiteItem } from '@/types/api';

const items: RodadaPalpiteItem[] = [
  {
    jogo: {
      id: 'j1', dataHora: new Date().toISOString(),
      pesoPontuacao: 2, placarCasa: 2, placarVisitante: 1,
      selecaoCasa:      { nome: 'Brasil',    codigo: 'BRA', bandeiraSvg: '<svg></svg>' },
      selecaoVisitante: { nome: 'Argentina', codigo: 'ARG', bandeiraSvg: '<svg></svg>' },
    },
    palpite: { placarCasa: 2, placarVisitante: 1 },
    pontuacao: 12,
  },
  {
    jogo: {
      id: 'j2', dataHora: new Date().toISOString(),
      pesoPontuacao: 1, placarCasa: 0, placarVisitante: 0,
      selecaoCasa:      { nome: 'Espanha', codigo: 'ESP', bandeiraSvg: '<svg></svg>' },
      selecaoVisitante: { nome: 'Portugal', codigo: 'POR', bandeiraSvg: '<svg></svg>' },
    },
    palpite: null,
    pontuacao: 0,
  },
];

it('renderiza siglas, placar real e pontuação por item', () => {
  render(<RankingPalpitesRodada items={items} />);
  expect(screen.getByText('BRA')).toBeInTheDocument();
  expect(screen.getByText('ARG')).toBeInTheDocument();
  expect(screen.getByText('2 × 1')).toBeInTheDocument();
  expect(screen.getByText(/Palpite: 2×1/)).toBeInTheDocument();
  expect(screen.getByText('+12 pts')).toBeInTheDocument();
});

it('exibe "Sem palpite" e omite pontuação no item sem palpite', () => {
  render(<RankingPalpitesRodada items={items} />);
  expect(screen.getByText(/Sem palpite/)).toBeInTheDocument();
  expect(screen.queryByText('+0 pts')).not.toBeInTheDocument();
});

it('mostra peso ×N apenas quando ≠1', () => {
  render(<RankingPalpitesRodada items={items} />);
  expect(screen.getByText('×2')).toBeInTheDocument();
  expect(screen.queryByText('×1')).not.toBeInTheDocument();
});

it('renderiza mensagem quando lista vazia', () => {
  render(<RankingPalpitesRodada items={[]} />);
  expect(screen.getByText(/esta rodada não tem jogos/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar o teste — deve falhar**

Run: `cd apps/frontend && pnpm test -- RankingPalpitesRodada.test`
Expected: FAIL (componente não existe).

- [ ] **Step 3: Implementar o componente**

`apps/frontend/src/components/RankingPalpitesRodada.tsx`:

```tsx
import type { RodadaPalpiteItem } from '@/types/api';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';

interface Props {
  items: RodadaPalpiteItem[];
}

export function RankingPalpitesRodada({ items }: Props) {
  if (items.length === 0) {
    return <p className="text-trovao-muted text-xs text-center py-2">Esta rodada não tem jogos.</p>;
  }
  return (
    <div className="space-y-1">
      <p className="text-trovao-muted text-[10px] uppercase tracking-wider">Palpites da rodada</p>
      <ul className="divide-y divide-trovao-border/30 rounded-lg bg-trovao-surface/40">
        {items.map(({ jogo, palpite, pontuacao }) => (
          <li key={jogo.id} className="px-2 py-2 space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <SelecaoAvatar nome={jogo.selecaoCasa.nome} bandeiraSvg={jogo.selecaoCasa.bandeiraSvg} size="sm" shape="rect" />
                <span className="text-white font-semibold">{jogo.selecaoCasa.codigo}</span>
                <span className="text-white font-bold mx-1">{jogo.placarCasa} × {jogo.placarVisitante}</span>
                <span className="text-white font-semibold">{jogo.selecaoVisitante.codigo}</span>
                <SelecaoAvatar nome={jogo.selecaoVisitante.nome} bandeiraSvg={jogo.selecaoVisitante.bandeiraSvg} size="sm" shape="rect" />
              </div>
              {jogo.pesoPontuacao !== 1 && (
                <span className="text-[10px] font-bold text-trovao-gold">×{jogo.pesoPontuacao}</span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-trovao-muted">
                {palpite ? `Palpite: ${palpite.placarCasa}×${palpite.placarVisitante}` : 'Sem palpite'}
              </span>
              {palpite && (
                <span className={pontuacao > 0 ? 'text-trovao-gold font-bold' : 'text-trovao-muted'}>
                  +{pontuacao} pts
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

> Nota: se `SelecaoAvatar` não suportar `size="sm"`, ajustar para o menor tamanho disponível ou omitir o avatar (usar só os códigos). Verificar `apps/frontend/src/components/SelecaoAvatar.tsx`.

- [ ] **Step 4: Rodar o teste — deve passar**

Run: `cd apps/frontend && pnpm test -- RankingPalpitesRodada.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/RankingPalpitesRodada.tsx apps/frontend/src/__tests__/RankingPalpitesRodada.test.tsx
git commit -m "feat(frontend): add RankingPalpitesRodada compact list"
```

---

## Task 9: Frontend — RankingRow ganha posicaoRodada e expand condicional

**Files:**
- Modify: `apps/frontend/src/components/RankingRow.tsx`.
- Modify: `apps/frontend/src/__tests__/RankingRow.test.tsx`.

- [ ] **Step 1: Adicionar testes da nova prop e do expand condicional**

Em `apps/frontend/src/__tests__/RankingRow.test.tsx`, **adicionar** (sem remover os existentes):

```ts
it('quando posicaoRodada é fornecida, exibe "Nª (P Mª)"', () => {
  render(<RankingRow entry={entry} bolaoId="b1" posicaoRodada={1} publicacaoNumero={3} />);
  expect(screen.getByText('1º')).toBeInTheDocument();
  expect(screen.getByText('(P 4º)')).toBeInTheDocument();
});

it('com publicacaoNumero ao expandir, busca palpites em vez de evolução', async () => {
  mockGet.mockResolvedValueOnce([]); // resposta dos palpites
  render(<RankingRow entry={entry} bolaoId="b1" posicaoRodada={1} publicacaoNumero={3} />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => {
    expect(mockGet).toHaveBeenCalledWith(
      '/boloes/b1/ranking/publicacoes/3/usuarios/u1/apostas',
    );
  });
  // contadores antigos não aparecem
  expect(screen.queryByText('Placar exato')).not.toBeInTheDocument();
});

it('sem publicacaoNumero, expand mostra contadores (comportamento atual)', async () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Placar exato')).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar testes — devem falhar**

Run: `cd apps/frontend && pnpm test -- RankingRow.test`
Expected: FAIL.

- [ ] **Step 3: Refatorar `RankingRow.tsx`**

Substituir o conteúdo do componente por:

```tsx
'use client';

import { useState } from 'react';
import type { RankingEntry, EvolucaoPonto, RodadaPalpiteItem } from '@/types/api';
import { api } from '@/lib/api';
import { RankingEvolucao } from './RankingEvolucao';
import { RankingPalpitesRodada } from './RankingPalpitesRodada';

interface RankingRowProps {
  entry: RankingEntry;
  myId?: string;
  bolaoId: string;
  posicaoRodada?: number;
  publicacaoNumero?: number;
}

const ACERTOS = [
  { label: 'Placar exato',                       key: 'acertosPlacarExato'    },
  { label: 'Placar do vencedor correto',         key: 'acertosPlacarVencedor' },
  { label: 'Empate correto (sem placar exato)',  key: 'acertosEmpate'         },
  { label: 'Placar do perdedor correto',         key: 'acertosPlacarPerdedor' },
  { label: 'Acertou apenas o vencedor',          key: 'acertosGanhador'       },
  { label: 'Acertou nada',                       key: 'acertosNada'           },
] as const;

export function RankingRow({ entry, myId, bolaoId, posicaoRodada, publicacaoNumero }: RankingRowProps) {
  const [expandido, setExpandido] = useState(false);
  const [evolucao, setEvolucao] = useState<EvolucaoPonto[] | null>(null);
  const [palpites, setPalpites] = useState<RodadaPalpiteItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const isMe = entry.usuarioId === myId;
  const modoRodada = publicacaoNumero !== undefined;

  const handleExpand = () => {
    const abrir = !expandido;
    setExpandido(abrir);
    if (!abrir) return;

    if (modoRodada && palpites === null) {
      setLoading(true);
      api.get<RodadaPalpiteItem[]>(
        `/boloes/${bolaoId}/ranking/publicacoes/${publicacaoNumero}/usuarios/${entry.usuarioId}/apostas`,
      )
        .then(setPalpites)
        .catch(() => setPalpites([]))
        .finally(() => setLoading(false));
      return;
    }

    if (!modoRodada && evolucao === null) {
      setLoading(true);
      api.get<EvolucaoPonto[]>(`/boloes/${bolaoId}/ranking/evolucao?usuarioId=${entry.usuarioId}`)
        .then(setEvolucao)
        .catch(() => setEvolucao([]))
        .finally(() => setLoading(false));
    }
  };

  return (
    <div className={`rounded-xl border transition-colors ${
      isMe ? 'border-trovao-gold/50 bg-trovao-gold/5' : 'border-trovao-border bg-trovao-card'
    }`}>
      <button onClick={handleExpand} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <span className="text-trovao-muted text-sm w-7 flex-shrink-0">
          {posicaoRodada !== undefined ? `${posicaoRodada}º` : `${entry.posicao}º`}
        </span>
        {posicaoRodada !== undefined && (
          <span className="text-trovao-muted text-[10px] flex-shrink-0">(P {entry.posicao}º)</span>
        )}

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
          {modoRodada ? (
            <>
              {loading && <p className="text-trovao-muted text-xs text-center py-2">Carregando palpites...</p>}
              {!loading && palpites && <RankingPalpitesRodada items={palpites} />}
            </>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar testes — devem passar**

Run: `cd apps/frontend && pnpm test -- RankingRow.test`
Expected: PASS (todos, antigos e novos).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/RankingRow.tsx apps/frontend/src/__tests__/RankingRow.test.tsx
git commit -m "feat(frontend): RankingRow exibe posicaoRodada e palpites no expand"
```

---

## Task 10: Frontend — página de ranking integra Rodada (sort, posicaoRodada, label data, linha auxiliar)

**Files:**
- Modify: `apps/frontend/src/app/(app)/ranking/[bolaoId]/page.tsx`.

- [ ] **Step 1: Substituir o sort e o map de Rodada por sort + posicaoRodada**

Em `apps/frontend/src/app/(app)/ranking/[bolaoId]/page.tsx`, trocar:

```ts
const ordenado = aba === 'rodada'
  ? [...ranking].sort((a, b) => b.pontuacaoRodada - a.pontuacaoRodada)
  : ranking;
```

por:

```ts
const ordenadoRodada = useMemo(() => {
  if (aba !== 'rodada') return [];
  return [...ranking]
    .sort((a, b) => {
      if (b.pontuacaoRodada !== a.pontuacaoRodada) return b.pontuacaoRodada - a.pontuacaoRodada;
      if (b.pontuacaoTotal !== a.pontuacaoTotal) return b.pontuacaoTotal - a.pontuacaoTotal;
      return a.usuario.nome.localeCompare(b.usuario.nome);
    })
    .map((entry, idx) => ({ entry, posicaoRodada: idx + 1 }));
}, [aba, ranking]);
```

Adicionar `import { useMemo, ... } from 'react';` (provavelmente já importado, só estender).

- [ ] **Step 2: Trocar a renderização do podium e da lista quando aba=rodada**

Substituir:

```ts
{aba === 'rodada' && (
  <RankingPodium
    ranking={ordenado.map(e => ({ ...e, pontuacaoTotal: e.pontuacaoRodada }))}
    myId={user?.id}
  />
)}
```

por:

```ts
{aba === 'rodada' && (
  <RankingPodium
    ranking={ordenadoRodada.map(({ entry }) => ({ ...entry, pontuacaoTotal: entry.pontuacaoRodada }))}
    myId={user?.id}
  />
)}
```

E o `.map` da lista de rows:

```tsx
<div className="space-y-2 mt-4">
  {aba === 'geral'
    ? ranking.map((entry) => (
        <RankingRow key={entry.id} entry={entry} myId={user?.id} bolaoId={bolaoId} />
      ))
    : ordenadoRodada.map(({ entry, posicaoRodada }) => (
        <RankingRow
          key={entry.id}
          entry={{ ...entry, pontuacaoTotal: entry.pontuacaoRodada, posicoesGanhas: 0 }}
          myId={user?.id}
          bolaoId={bolaoId}
          posicaoRodada={posicaoRodada}
          publicacaoNumero={publicacaoSel ?? undefined}
        />
      ))}
</div>
```

- [ ] **Step 3: Trocar o label do select para data formatada**

Adicionar `import { formatDataPublicacao } from '@/lib/dataFormat';` no topo.

Substituir:

```tsx
{publicacoes.map((p) => (
  <option key={p.numero} value={p.numero}>Rodada {p.numero}</option>
))}
```

por:

```tsx
{publicacoes.map((p) => (
  <option key={p.numero} value={p.numero}>{formatDataPublicacao(p.publicadoEm)}</option>
))}
```

- [ ] **Step 4: Adicionar linha auxiliar abaixo do select**

Trocar o bloco do select (lines ~91-101 atuais):

```tsx
{aba === 'rodada' && publicacoes.length > 0 && (
  <select ... >
    {publicacoes.map(...)}
  </select>
)}
```

por:

```tsx
{aba === 'rodada' && publicacoes.length > 0 && (
  <div className="flex flex-col items-end gap-0.5">
    <select
      value={publicacaoSel ?? ''}
      onChange={(e) => setPublicacaoSel(Number(e.target.value))}
      className="bg-trovao-surface border border-trovao-border rounded-lg text-sm px-2 py-1 text-white"
    >
      {publicacoes.map((p) => (
        <option key={p.numero} value={p.numero}>{formatDataPublicacao(p.publicadoEm)}</option>
      ))}
    </select>
    <p className="text-trovao-muted text-[10px] leading-tight">
      Data da publicação · pode diferir da data dos jogos
    </p>
  </div>
)}
```

- [ ] **Step 5: Rodar typecheck + full suite frontend**

Run: `cd apps/frontend && pnpm exec tsc --noEmit && pnpm test`
Expected: PASS.

- [ ] **Step 6: Smoke test no dev server**

Run: `pnpm dev` (em outro terminal, ou já rodando).

Verificar manualmente em `http://localhost:3000/ranking/<bolaoId-de-teste>`:
- Aba Geral: comportamento inalterado.
- Aba Rodada: select mostra `dd/mm/yyyy`; linha cinza embaixo aparece. Linhas mostram `1º (P 4º)` etc., reordenadas. Expandir um row → carrega "Palpites da rodada" (lista nova).

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/app/\(app\)/ranking/\[bolaoId\]/page.tsx
git commit -m "feat(frontend): aba Rodada reordena, mostra posicao da rodada e label por data"
```

---

## Task 11: Frontend — modal de confirmação `AdminPublicarDialog`

**Files:**
- Create: `apps/frontend/src/components/AdminPublicarDialog.tsx`.
- Create: `apps/frontend/src/__tests__/AdminPublicarDialog.test.tsx`.

- [ ] **Step 1: Escrever o teste**

`apps/frontend/src/__tests__/AdminPublicarDialog.test.tsx`:

```ts
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminPublicarDialog } from '@/components/AdminPublicarDialog';
import type { JogoPendente } from '@/types/api';

const jogos: JogoPendente[] = [
  {
    id: 'j1', dataHora: new Date().toISOString(), rodada: 1, fase: 'OITAVAS',
    pesoPontuacao: 2, placarCasa: 2, placarVisitante: 1,
    selecaoCasa:      { nome: 'Brasil',    codigo: 'BRA', bandeiraSvg: '<svg></svg>' },
    selecaoVisitante: { nome: 'Argentina', codigo: 'ARG', bandeiraSvg: '<svg></svg>' },
  },
  {
    id: 'j2', dataHora: new Date().toISOString(), rodada: 1, fase: 'OITAVAS',
    pesoPontuacao: 1, placarCasa: 0, placarVisitante: 0,
    selecaoCasa:      { nome: 'Espanha', codigo: 'ESP', bandeiraSvg: '<svg></svg>' },
    selecaoVisitante: { nome: 'Portugal', codigo: 'POR', bandeiraSvg: '<svg></svg>' },
  },
];

it('quando open=true, mostra título com contagem e cada jogo', () => {
  render(<AdminPublicarDialog open={true} jogos={jogos} onCancel={jest.fn()} onConfirm={jest.fn()} />);
  expect(screen.getByText(/Confirmar publicação · 2 jogos/i)).toBeInTheDocument();
  expect(screen.getByText('BRA')).toBeInTheDocument();
  expect(screen.getByText('ARG')).toBeInTheDocument();
  expect(screen.getByText('2 × 1')).toBeInTheDocument();
  expect(screen.getByText('×2')).toBeInTheDocument();
  expect(screen.getByText('×1')).toBeInTheDocument(); // peso sempre exibido
});

it('chama onConfirm ao clicar em Publicar', () => {
  const onConfirm = jest.fn();
  render(<AdminPublicarDialog open={true} jogos={jogos} onCancel={jest.fn()} onConfirm={onConfirm} />);
  fireEvent.click(screen.getByRole('button', { name: /publicar/i }));
  expect(onConfirm).toHaveBeenCalled();
});

it('Publicar fica disabled e mostra "Publicando..." quando publicando=true', () => {
  render(<AdminPublicarDialog open={true} jogos={jogos} publicando={true} onCancel={jest.fn()} onConfirm={jest.fn()} />);
  expect(screen.getByRole('button', { name: /publicando/i })).toBeDisabled();
});
```

- [ ] **Step 2: Rodar o teste — deve falhar**

Run: `cd apps/frontend && pnpm test -- AdminPublicarDialog.test`
Expected: FAIL.

- [ ] **Step 3: Implementar o componente**

`apps/frontend/src/components/AdminPublicarDialog.tsx`:

```tsx
'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';
import type { JogoPendente } from '@/types/api';

interface Props {
  open: boolean;
  jogos: JogoPendente[];
  publicando?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function AdminPublicarDialog({ open, jogos, publicando, onCancel, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogTitle>Confirmar publicação · {jogos.length} jogo{jogos.length === 1 ? '' : 's'}</DialogTitle>
        <ul className="max-h-[60vh] overflow-y-auto divide-y divide-trovao-border/40">
          {jogos.map((j) => (
            <li key={j.id} className="flex items-center justify-between px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <SelecaoAvatar nome={j.selecaoCasa.nome} bandeiraSvg={j.selecaoCasa.bandeiraSvg} size="sm" shape="rect" />
                <span className="text-white font-semibold">{j.selecaoCasa.codigo}</span>
                <span className="text-white font-bold mx-1">{j.placarCasa} × {j.placarVisitante}</span>
                <span className="text-white font-semibold">{j.selecaoVisitante.codigo}</span>
                <SelecaoAvatar nome={j.selecaoVisitante.nome} bandeiraSvg={j.selecaoVisitante.bandeiraSvg} size="sm" shape="rect" />
              </div>
              <div className="flex items-center gap-2 text-trovao-muted shrink-0">
                <span className="text-[10px] font-bold text-trovao-gold">×{j.pesoPontuacao}</span>
                <span className="text-[10px] uppercase">{j.fase}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} disabled={publicando}
            className="px-3 py-1.5 text-xs rounded-lg border border-trovao-border text-trovao-muted hover:text-white disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={publicando}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-trovao-gold text-trovao-base disabled:opacity-50">
            {publicando ? 'Publicando...' : 'Publicar'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

> Nota: se `SelecaoAvatar` não tiver `size="sm"`, usar o menor existente. Conferir antes.

- [ ] **Step 4: Rodar testes**

Run: `cd apps/frontend && pnpm test -- AdminPublicarDialog.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/AdminPublicarDialog.tsx apps/frontend/src/__tests__/AdminPublicarDialog.test.tsx
git commit -m "feat(frontend): add AdminPublicarDialog confirmation modal"
```

---

## Task 12: Frontend — AdminRankingPreview com guard e modal

**Files:**
- Modify: `apps/frontend/src/components/AdminRankingPreview.tsx`.

> Esse componente não tem teste unitário hoje; smoke test via dev server cobre o fluxo.

- [ ] **Step 1: Refatorar para carregar pendentes + abrir modal**

Substituir conteúdo de `apps/frontend/src/components/AdminRankingPreview.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AdminPublicarDialog } from '@/components/AdminPublicarDialog';
import type { JogoPendente, RankingEntry } from '@/types/api';

interface Props { bolaoId: string }

export function AdminRankingPreview({ bolaoId }: Props) {
  const [ranking, setRanking]   = useState<RankingEntry[]>([]);
  const [pendentes, setPendentes] = useState<JogoPendente[] | null>(null);
  const [loading, setLoading]   = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [publicando, setPublicando]   = useState(false);
  const [publicado, setPublicado]     = useState(false);
  const [erro, setErro]               = useState('');

  async function carregar() {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        api.get<RankingEntry[]>(`/admin/ranking/${bolaoId}/draft`),
        api.get<JogoPendente[]>(`/admin/publicacoes/pendente`),
      ]);
      setRanking(r);
      setPendentes(p);
    } catch {
      setRanking([]);
      setPendentes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, [bolaoId]);

  async function publicar() {
    setPublicando(true);
    setErro('');
    try {
      await api.post('/admin/publicacoes');
      setPublicado(true);
      setConfirmando(false);
      carregar();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao publicar.');
    } finally {
      setPublicando(false);
    }
  }

  if (loading) return <p className="text-trovao-muted text-sm">Carregando draft...</p>;

  const qtdPendentes = pendentes?.length ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-trovao-muted text-xs">{ranking.length} participantes</p>
        {publicado ? (
          <span className="text-trovao-green text-xs font-semibold">Publicado</span>
        ) : (
          <div className="flex flex-col items-end gap-0.5">
            <button
              onClick={() => setConfirmando(true)}
              disabled={publicando || qtdPendentes === 0}
              className="px-3 py-1.5 bg-trovao-gold text-trovao-base text-xs font-bold rounded-lg disabled:opacity-50"
            >
              Publicar rodada (global)
            </button>
            <p className="text-trovao-muted text-[10px]">
              {qtdPendentes === 0
                ? 'Nenhum jogo com placar pendente de publicação'
                : `${qtdPendentes} jogo${qtdPendentes === 1 ? '' : 's'} prontos para publicar`}
            </p>
          </div>
        )}
      </div>
      {erro && <p className="text-trovao-red text-xs">{erro}</p>}
      <div className="space-y-2">
        {ranking.map(r => (
          <div key={r.id} className="flex items-center justify-between px-3 py-2 bg-trovao-surface rounded-lg text-sm">
            <span className="text-trovao-muted w-6">{r.posicao}º</span>
            <span className="flex-1 text-white">{r.usuario.nome}</span>
            {r.posicoesGanhas !== 0 && (
              <span className={`text-xs font-semibold tabular-nums mr-2 ${
                r.posicoesGanhas > 0 ? 'text-trovao-green' : 'text-trovao-red'
              }`}>
                {r.posicoesGanhas > 0 ? '▲' : '▼'}{Math.abs(r.posicoesGanhas)}
              </span>
            )}
            <span className="text-trovao-gold font-bold tabular-nums">{r.pontuacaoTotal} pts</span>
          </div>
        ))}
      </div>

      <AdminPublicarDialog
        open={confirmando}
        jogos={pendentes ?? []}
        publicando={publicando}
        onCancel={() => setConfirmando(false)}
        onConfirm={publicar}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + full suite**

Run: `cd apps/frontend && pnpm exec tsc --noEmit && pnpm test`
Expected: PASS.

- [ ] **Step 3: Smoke test no dev server**

Em `/admin/ranking`:
- Quando não há pendência: botão cinza, texto cinza "Nenhum jogo com placar pendente...".
- Quando há pendência: botão habilitado + "N jogos prontos para publicar"; clicar abre modal com jogos+placares+peso; "Publicar" confirma; "Cancelar"/ESC fecham; pós-publicação recarrega e pendentes vão a 0.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/AdminRankingPreview.tsx
git commit -m "feat(frontend): admin publicar com guard + dialogo de confirmação"
```

---

## Task 13: Frontend — busca client-side em /admin/usuarios

**Files:**
- Modify: `apps/frontend/src/app/admin/usuarios/page.tsx`.

- [ ] **Step 1: Refatorar a página**

Substituir conteúdo de `apps/frontend/src/app/admin/usuarios/page.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { AdminUsuarioRow } from '@/components/AdminUsuarioRow';
import { PageSkeleton } from '@/components/PageSkeleton';
import type { Usuario } from '@/types/api';

function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState('');

  async function carregar() {
    setLoading(true);
    const data = await api.get<Usuario[]>('/admin/usuarios').catch(() => [] as Usuario[]);
    setUsuarios(data);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  const filtrados = useMemo(() => {
    const q = normalizar(query.trim());
    if (!q) return usuarios;
    return usuarios.filter(
      (u) => normalizar(u.nome).includes(q) || normalizar(u.email).includes(q),
    );
  }, [usuarios, query]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Usuários</h1>

      <div className="space-y-2">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou email"
            className="w-full bg-trovao-card border border-trovao-border rounded-xl
                       pl-9 pr-9 py-2 text-sm text-white placeholder:text-trovao-muted
                       focus:outline-none focus:border-trovao-gold"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-trovao-muted pointer-events-none"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 text-trovao-muted hover:text-white"
            >×</button>
          )}
        </div>
        {query && (
          <p className="text-trovao-muted text-xs">{filtrados.length} de {usuarios.length} usuários</p>
        )}
      </div>

      {loading ? (
        <PageSkeleton />
      ) : query && filtrados.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <p className="text-trovao-muted text-sm">Nenhum usuário corresponde à busca.</p>
          <button onClick={() => setQuery('')} className="text-trovao-gold text-xs font-semibold">Limpar</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((u) => (
            <AdminUsuarioRow key={u.id} usuario={u} onAtualizado={carregar} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + full suite**

Run: `cd apps/frontend && pnpm exec tsc --noEmit && pnpm test`
Expected: PASS.

- [ ] **Step 3: Smoke test**

`/admin/usuarios`:
- Digitar parte do nome/email filtra a lista; contagem aparece; "×" limpa; empty state aparece com "Limpar"; sem persistência ao recarregar.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/app/admin/usuarios/page.tsx
git commit -m "feat(frontend): busca client-side em admin/usuarios"
```

---

## Task 14: Documentação — README atualizado

**Files:**
- Modify: `README.md`.

Convenção do projeto: README sempre acompanha mudanças de regras de negócio ou arquitetura.

- [ ] **Step 1: Atualizar trechos do README**

Na seção "Funcionalidades" (linha ~7-17), substituir:

```
- **Ranking por publicação** — participantes veem um snapshot congelado publicado pelo admin; dois modos: **Geral** (acumulado) e **Rodada** (pontos da publicação)
```

por:

```
- **Ranking por publicação** — participantes veem um snapshot congelado publicado pelo admin; dois modos: **Geral** (acumulado) e **Rodada** (seletor por data da publicação, ranking reordenado pela pontuação da rodada e lista de palpites do usuário no expand)
```

E no item de Painel administrativo, substituir:

```
- **Painel administrativo** — habilitar/desabilitar bolões, gerenciar placares, pré-visualizar ranking (draft ao vivo), publicar rankings globalmente e gerir usuários (ativar/desativar, resetar senha)
```

por:

```
- **Painel administrativo** — habilitar/desabilitar bolões, gerenciar placares, pré-visualizar ranking (draft ao vivo), publicar rankings globalmente (com modal de confirmação listando os jogos da rodada) e gerir usuários com busca por nome/email (ativar/desativar, resetar senha)
```

Na seção "Publicação", adicionar um parágrafo logo após o item 8 (linha ~243):

```
> O botão "Publicar rodada" no admin só fica habilitado quando há jogo com placar preenchido e ainda sem publicação. A confirmação prévia exibe os jogos e placares que entrarão na rodada.
```

- [ ] **Step 2: Verificar diff**

Run: `git diff README.md`

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: atualiza README com guard de publicação e palpites no expand"
```

---

## Resumo de commits esperados

1. `feat(backend): add GET /admin/publicacoes/pendente`
2. `refactor(backend): share pending-games criterion between publicar and admin`
3. `feat(backend): add palpites-da-rodada endpoint for ranking expand`
4. `feat(frontend): add formatDataPublicacao helper`
5. `feat(frontend): split EstadoAposta into 5 states and surface finalizado/aguardando` (agrupa Task 5+6)
6. `feat(frontend): add JogoPendente and RodadaPalpiteItem types`
7. `feat(frontend): add RankingPalpitesRodada compact list`
8. `feat(frontend): RankingRow exibe posicaoRodada e palpites no expand`
9. `feat(frontend): aba Rodada reordena, mostra posicao da rodada e label por data`
10. `feat(frontend): add AdminPublicarDialog confirmation modal`
11. `feat(frontend): admin publicar com guard + dialogo de confirmação`
12. `feat(frontend): busca client-side em admin/usuarios`
13. `docs: atualiza README com guard de publicação e palpites no expand`
