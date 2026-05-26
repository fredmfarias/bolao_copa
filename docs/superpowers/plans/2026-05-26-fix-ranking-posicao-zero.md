# Fix Ranking — posição 0, desempate alfabético e usuários ativos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o ranking para que membros sem apostas fiquem no fundo (não no topo com posição 0), aplicar desempate alfabético e rankear apenas usuários ativos.

**Architecture:** Toda a mudança fica em `RankingService.recalcularRankingBolao` e `RankingService.comparadorRanking`. O recalc passa a semear o mapa com todos os membros **ativos** do bolão (zerados, carregando o `nome`), acumula apostas pontuadas por cima, ordena com desempate alfabético final e remove linhas `Ranking` de membros não-ativos. Como o recalc roda a cada publicação e no preview admin, a correção vale automaticamente "a cada rodada".

**Tech Stack:** NestJS, Prisma (PostgreSQL), Jest.

---

## File Structure

- Modify: `apps/backend/src/ranking/ranking.service.ts`
  - `recalcularRankingBolao` (linhas 94-147): semear membros ativos, carregar `nome`, remover inativos.
  - `comparadorRanking` (linhas 149-157): acrescentar desempate alfabético.
- Test: `apps/backend/src/ranking/ranking.service.spec.ts`
  - Novo bloco `describe('recalcularRankingBolao')` com mock de Prisma próprio.

Nenhuma migração de schema. Fix-forward apenas (snapshots antigos ficam como estão).

---

### Task 1: Semear membros ativos e remover inativos no recalc

**Files:**
- Modify: `apps/backend/src/ranking/ranking.service.ts:94-147`
- Test: `apps/backend/src/ranking/ranking.service.spec.ts`

- [ ] **Step 1: Escrever os testes que falham**

Adicione este bloco `describe` ao **final** de `apps/backend/src/ranking/ranking.service.spec.ts` (depois do `describe('RankingService leitura de snapshot', ...)`, antes do fim do arquivo):

```typescript
describe('RankingService.recalcularRankingBolao', () => {
  const prismaMock = {
    bolaoMembro: { findMany: jest.fn() },
    aposta: { findMany: jest.fn() },
    ranking: { upsert: jest.fn(), deleteMany: jest.fn() },
  };
  let service: RankingService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [RankingService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(RankingService);
    jest.clearAllMocks();
    prismaMock.ranking.upsert.mockResolvedValue({});
    prismaMock.ranking.deleteMany.mockResolvedValue({});
  });

  function posicaoDe(usuarioId: string): number | undefined {
    const call = prismaMock.ranking.upsert.mock.calls.find(
      (c: any) => c[0].where.bolaoId_usuarioId.usuarioId === usuarioId,
    );
    return call?.[0].update.posicao;
  }

  it('só busca membros ativos do bolão', async () => {
    prismaMock.bolaoMembro.findMany.mockResolvedValue([]);
    prismaMock.aposta.findMany.mockResolvedValue([]);
    await service.recalcularRankingBolao('b1');
    expect(prismaMock.bolaoMembro.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bolaoId: 'b1', usuario: { ativo: true } },
      }),
    );
  });

  it('membro sem apostas fica no fundo, não no topo', async () => {
    prismaMock.bolaoMembro.findMany.mockResolvedValue([
      { usuarioId: 'u-ana', usuario: { nome: 'Ana' } },
      { usuarioId: 'u-bob', usuario: { nome: 'Bob' } },
    ]);
    prismaMock.aposta.findMany.mockResolvedValue([
      {
        usuarioId: 'u-ana',
        placarCasa: 2,
        placarVisitante: 1,
        pontuacao: 10,
        jogo: { placarCasa: 2, placarVisitante: 1 },
      },
    ]);

    await service.recalcularRankingBolao('b1');

    expect(posicaoDe('u-ana')).toBe(1);
    expect(posicaoDe('u-bob')).toBe(2);
  });

  it('não envia o campo nome no upsert (não é coluna do Ranking)', async () => {
    prismaMock.bolaoMembro.findMany.mockResolvedValue([
      { usuarioId: 'u-ana', usuario: { nome: 'Ana' } },
    ]);
    prismaMock.aposta.findMany.mockResolvedValue([]);

    await service.recalcularRankingBolao('b1');

    const call = prismaMock.ranking.upsert.mock.calls[0][0];
    expect(call.update).not.toHaveProperty('nome');
    expect(call.create).not.toHaveProperty('nome');
  });

  it('remove linhas Ranking de membros não-ativos', async () => {
    prismaMock.bolaoMembro.findMany.mockResolvedValue([
      { usuarioId: 'u-ana', usuario: { nome: 'Ana' } },
      { usuarioId: 'u-bob', usuario: { nome: 'Bob' } },
    ]);
    prismaMock.aposta.findMany.mockResolvedValue([]);

    await service.recalcularRankingBolao('b1');

    expect(prismaMock.ranking.deleteMany).toHaveBeenCalledWith({
      where: { bolaoId: 'b1', usuarioId: { notIn: ['u-ana', 'u-bob'] } },
    });
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd apps/backend && pnpm test -- ranking.service`
Expected: FAIL no novo bloco `recalcularRankingBolao` — `bolaoMembro.findMany` é chamado sem `usuario: { ativo: true }`, `u-bob` não recebe posição (fica `undefined`), e `deleteMany` não é chamado.

- [ ] **Step 3: Reescrever `recalcularRankingBolao`**

Substitua o corpo do método `recalcularRankingBolao` (atualmente `apps/backend/src/ranking/ranking.service.ts:94-147`) por:

```typescript
  async recalcularRankingBolao(bolaoId: string) {
    const membros = await this.prisma.bolaoMembro.findMany({
      where: { bolaoId, usuario: { ativo: true } },
      select: { usuarioId: true, usuario: { select: { nome: true } } },
    });
    const usuarioIds = membros.map((m) => m.usuarioId);

    const apostas = await this.prisma.aposta.findMany({
      where: { usuarioId: { in: usuarioIds }, pontuacao: { not: null } },
      include: { jogo: true },
    });

    const porUsuario = new Map<string, any>();

    // Semeia todos os membros ativos zerados, carregando o nome para o desempate.
    for (const m of membros) {
      porUsuario.set(m.usuarioId, {
        nome: m.usuario.nome,
        pontuacaoTotal: 0, acertosPlacarExato: 0, acertosPlacarVencedor: 0,
        acertosPlacarPerdedor: 0, acertosEmpate: 0, acertosGanhador: 0,
        acertosNada: 0, apostasPostadas: 0,
      });
    }

    for (const aposta of apostas) {
      const r = porUsuario.get(aposta.usuarioId);
      if (!r) continue;
      r.apostasPostadas += 1;
      r.pontuacaoTotal += aposta.pontuacao ?? 0;

      if (aposta.jogo.placarCasa !== null && aposta.jogo.placarVisitante !== null) {
        const nivel = this.calcularNivel(
          { placarCasa: aposta.placarCasa, placarVisitante: aposta.placarVisitante },
          { placarCasa: aposta.jogo.placarCasa, placarVisitante: aposta.jogo.placarVisitante },
        );
        if (nivel === 1) r.acertosPlacarExato += 1;
        else if (nivel === 2) r.acertosPlacarVencedor += 1;
        else if (nivel === 3) r.acertosEmpate += 1;
        else if (nivel === 4) r.acertosPlacarPerdedor += 1;
        else if (nivel === 5) r.acertosGanhador += 1;
        else r.acertosNada += 1;
      }
    }

    const rankings = Array.from(porUsuario.entries())
      .map(([usuarioId, dados]) => ({ usuarioId, ...dados }));

    rankings.sort(this.comparadorRanking);
    rankings.forEach((r, idx) => (r.posicao = idx + 1));

    for (const r of rankings) {
      const { nome, ...dados } = r; // nome é só para o desempate, não é coluna do Ranking
      await this.prisma.ranking.upsert({
        where: { bolaoId_usuarioId: { bolaoId, usuarioId: r.usuarioId } },
        update: dados,
        create: { bolaoId, ...dados },
      });
    }

    // Remove linhas de membros não-ativos (ex.: desativados após o join).
    await this.prisma.ranking.deleteMany({
      where: { bolaoId, usuarioId: { notIn: usuarioIds } },
    });
  }
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd apps/backend && pnpm test -- ranking.service`
Expected: PASS em todos os testes do bloco `recalcularRankingBolao` (o teste de desempate alfabético da Task 2 ainda não existe).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/ranking/ranking.service.ts apps/backend/src/ranking/ranking.service.spec.ts
git commit -m "fix: ranking inclui membros ativos sem apostas e remove inativos"
```

---

### Task 2: Desempate alfabético no comparadorRanking

**Files:**
- Modify: `apps/backend/src/ranking/ranking.service.ts:149-157`
- Test: `apps/backend/src/ranking/ranking.service.spec.ts` (mesmo bloco da Task 1)

- [ ] **Step 1: Escrever o teste que falha**

Adicione este `it` dentro do bloco `describe('RankingService.recalcularRankingBolao', ...)` criado na Task 1:

```typescript
  it('desempata por ordem alfabética crescente do nome', async () => {
    prismaMock.bolaoMembro.findMany.mockResolvedValue([
      { usuarioId: 'u-bruno', usuario: { nome: 'Bruno' } },
      { usuarioId: 'u-ana', usuario: { nome: 'Ana' } },
    ]);
    prismaMock.aposta.findMany.mockResolvedValue([]);

    await service.recalcularRankingBolao('b1');

    expect(posicaoDe('u-ana')).toBe(1);
    expect(posicaoDe('u-bruno')).toBe(2);
  });
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd apps/backend && pnpm test -- ranking.service`
Expected: FAIL — sem o desempate alfabético, os dois empatam (todos os critérios em 0) e a ordem segue a inserção (`u-bruno` em 1º), então `posicaoDe('u-ana')` é `2`.

- [ ] **Step 3: Acrescentar o critério alfabético**

Substitua o método `comparadorRanking` (atualmente `apps/backend/src/ranking/ranking.service.ts:149-157`) por:

```typescript
  private comparadorRanking(a: any, b: any): number {
    if (b.pontuacaoTotal !== a.pontuacaoTotal) return b.pontuacaoTotal - a.pontuacaoTotal;
    if (b.acertosPlacarExato !== a.acertosPlacarExato) return b.acertosPlacarExato - a.acertosPlacarExato;
    if (b.acertosPlacarVencedor !== a.acertosPlacarVencedor) return b.acertosPlacarVencedor - a.acertosPlacarVencedor;
    if (b.acertosEmpate !== a.acertosEmpate) return b.acertosEmpate - a.acertosEmpate;
    if (b.acertosPlacarPerdedor !== a.acertosPlacarPerdedor) return b.acertosPlacarPerdedor - a.acertosPlacarPerdedor;
    if (b.acertosGanhador !== a.acertosGanhador) return b.acertosGanhador - a.acertosGanhador;
    return (a.nome ?? '').localeCompare(b.nome ?? '');
  }
```

- [ ] **Step 4: Rodar todos os testes do serviço e confirmar que passam**

Run: `cd apps/backend && pnpm test -- ranking.service`
Expected: PASS em todos os testes (incluindo `calcularNivel`, leitura de snapshot e `recalcularRankingBolao`).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/ranking/ranking.service.ts apps/backend/src/ranking/ranking.service.spec.ts
git commit -m "fix: desempate alfabético no ranking"
```

---

### Task 3: Validação final e README

**Files:**
- Modify: `README.md` (se descrever regras de ranking/desempate)

- [ ] **Step 1: Rodar a suíte completa do backend**

Run: `cd apps/backend && pnpm test`
Expected: PASS em todos os testes.

- [ ] **Step 2: Verificar/atualizar o README**

Run: `grep -n -i "desempate\|ranking\|posi" README.md`
Se houver descrição das regras de ranking/desempate, atualize para refletir: (1) usuários sem aposta entram com 0 pontos no fundo; (2) ordem de desempate termina em ordem alfabética do nome; (3) apenas usuários ativos são rankeados. Se o README não cobrir essas regras, nenhuma alteração é necessária.

- [ ] **Step 3: Commit (apenas se o README mudou)**

```bash
git add README.md
git commit -m "docs: atualiza regras de ranking no README"
```

---

## Self-Review

- **Cobertura do spec:**
  - "aposta não realizada gera 0 / membro no fundo" → Task 1 (seed de membros ativos zerados).
  - "apenas usuários ativos" → Task 1 (filtro `usuario: { ativo: true }` + `deleteMany` de inativos).
  - "desempate alfabético" → Task 2.
  - "posição recalculada a cada rodada" → coberto sem código novo (recalc roda em `publicacao.service.ts:53`).
  - "fix-forward, sem backfill" → nenhum task de migração, conforme spec.
- **Placeholders:** nenhum — todos os steps têm código/comando completos.
- **Consistência de tipos:** `nome` é semeado em Task 1 e consumido por `comparadorRanking` em Task 2; `dados` (sem `nome`) é o objeto enviado ao upsert; `usuarioIds` reusado no `deleteMany`. Nomes de métodos (`recalcularRankingBolao`, `comparadorRanking`, `calcularNivel`) batem com o código atual.
