# Aproveitamento por usuário no ranking Geral — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir, na linha do ranking Geral, o aproveitamento de cada usuário — sua `pontuacaoTotal` como percentual do máximo possível somando os jogos já publicados.

**Architecture:** O backend (`RankingService.obterRanking`) calcula uma vez o máximo possível (`pontosPlacarExato × pesoPontuacao` sobre todo jogo com `publicacaoId != null`) e anexa um campo `aproveitamento` (inteiro, em %) a cada entrada, mantendo o contrato `RankingEntry[]`. O frontend exibe a pontuação em destaque com um badge `%` pequeno no canto inferior direito da linha, apenas no modo Geral, sem alterar a altura da linha.

**Tech Stack:** NestJS 10 + Prisma 5 (backend), Jest/ts-jest; Next.js 14 + React 18 + Tailwind + Testing Library (frontend); pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-06-22-aproveitamento-ranking-design.md`

**Branch:** `feat/aproveitamento-ranking` (já criada e com o spec commitado).

---

## Task 1: Backend — calcular e anexar `aproveitamento` em `obterRanking`

**Files:**
- Modify: `apps/backend/src/ranking/ranking.service.ts` (método `obterRanking`, ~linhas 60-71; adicionar helper privado)
- Test: `apps/backend/src/ranking/ranking.service.spec.ts` (bloco `describe('obterRanking', ...)`, ~linhas 42-86)

Contexto: hoje `obterRanking` retorna direto o resultado de `prisma.rankingSnapshot.findMany`. O denominador é global (jogos e publicações são entidades globais), então é 1 cálculo por requisição. `ConfiguracaoPontuacao` com `nivel: 1` é "Placar exato" (hoje `pontos: 10`).

- [ ] **Step 1: Estender o `prismaMock` do spec com `configuracaoPontuacao`**

Em `apps/backend/src/ranking/ranking.service.spec.ts`, o objeto `prismaMock` (atualmente linhas 43-48) passa a incluir `configuracaoPontuacao`. Substituir o objeto por:

```ts
  const prismaMock = {
    publicacao: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    rankingSnapshot: { findMany: jest.fn() },
    jogo: { findMany: jest.fn() },
    aposta: { findMany: jest.fn() },
    configuracaoPontuacao: { findFirst: jest.fn() },
  };
```

- [ ] **Step 2: Escrever os testes que falham**

Adicionar, dentro do bloco `describe('obterRanking', () => { ... })` (logo após o teste `'usa a publicação informada por numero'`, antes do `});` que fecha o describe), estes três testes:

```ts
    it('anexa aproveitamento relativo ao máximo possível', async () => {
      prismaMock.publicacao.findFirst.mockResolvedValue({ id: 'pub-1', numero: 1 });
      prismaMock.rankingSnapshot.findMany.mockResolvedValue([
        { id: 's1', posicao: 1, pontuacaoTotal: 20 },
        { id: 's2', posicao: 2, pontuacaoTotal: 5 },
      ]);
      prismaMock.configuracaoPontuacao.findFirst.mockResolvedValue({ pontos: 10 });
      // max = 10 (placar exato) × (5 + 5) de peso = 100
      prismaMock.jogo.findMany.mockResolvedValue([{ pesoPontuacao: 5 }, { pesoPontuacao: 5 }]);

      const r = await service.obterRanking('b1');

      expect(r[0].aproveitamento).toBe(20); // 20/100
      expect(r[1].aproveitamento).toBe(5);  // 5/100
      expect(prismaMock.jogo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { publicacaoId: { not: null } } }),
      );
    });

    it('aproveitamento = 0 quando o máximo possível é 0 (sem jogos publicados)', async () => {
      prismaMock.publicacao.findFirst.mockResolvedValue({ id: 'pub-1', numero: 1 });
      prismaMock.rankingSnapshot.findMany.mockResolvedValue([
        { id: 's1', posicao: 1, pontuacaoTotal: 20 },
      ]);
      prismaMock.configuracaoPontuacao.findFirst.mockResolvedValue({ pontos: 10 });
      prismaMock.jogo.findMany.mockResolvedValue([]);

      const r = await service.obterRanking('b1');

      expect(r[0].aproveitamento).toBe(0);
    });

    it('respeita os pontos do nível 1 vindos da configuração', async () => {
      prismaMock.publicacao.findFirst.mockResolvedValue({ id: 'pub-1', numero: 1 });
      prismaMock.rankingSnapshot.findMany.mockResolvedValue([
        { id: 's1', posicao: 1, pontuacaoTotal: 6 },
      ]);
      prismaMock.configuracaoPontuacao.findFirst.mockResolvedValue({ pontos: 12 });
      prismaMock.jogo.findMany.mockResolvedValue([{ pesoPontuacao: 1 }]); // max = 12

      const r = await service.obterRanking('b1');

      expect(r[0].aproveitamento).toBe(50); // 6/12
      expect(prismaMock.configuracaoPontuacao.findFirst).toHaveBeenCalledWith({
        where: { nivel: 1 },
      });
    });
```

- [ ] **Step 3: Rodar os testes e ver falhar**

Run: `pnpm --filter @bolao/backend test -- ranking.service.spec`
Expected: FAIL — os três novos testes falham (`aproveitamento` é `undefined`; `r[0].aproveitamento` não bate). Os testes existentes continuam passando.

- [ ] **Step 4: Implementar o cálculo em `obterRanking`**

Em `apps/backend/src/ranking/ranking.service.ts`, substituir o método `obterRanking` inteiro (linhas 60-71) por:

```ts
  async obterRanking(bolaoId: string, numero?: number) {
    const publicacao = numero
      ? await this.prisma.publicacao.findUnique({ where: { numero } })
      : await this.prisma.publicacao.findFirst({ orderBy: { numero: 'desc' } });
    if (!publicacao) return [];

    const snapshots = await this.prisma.rankingSnapshot.findMany({
      where: { bolaoId, publicacaoId: publicacao.id },
      include: { usuario: { select: { id: true, nome: true, avatarUrl: true } } },
      orderBy: { posicao: 'asc' },
    });

    const maxPossivel = await this.calcularMaxPossivel();

    return snapshots.map((s) => ({
      ...s,
      aproveitamento:
        maxPossivel > 0 ? Math.round((s.pontuacaoTotal / maxPossivel) * 100) : 0,
    }));
  }

  // Máximo de pontos possível somando os jogos já publicados:
  // placar exato (nível 1) × peso de cada jogo. Global: jogos e publicações
  // não são por bolão. O `?? []`/guards mantêm o método seguro com mocks parciais.
  private async calcularMaxPossivel(): Promise<number> {
    const config = await this.prisma.configuracaoPontuacao.findFirst({
      where: { nivel: 1 },
    });
    const pontosExato = config?.pontos ?? 0;
    if (pontosExato === 0) return 0;

    const jogos = await this.prisma.jogo.findMany({
      where: { publicacaoId: { not: null } },
      select: { pesoPontuacao: true },
    });
    return (jogos ?? []).reduce((acc, j) => acc + pontosExato * j.pesoPontuacao, 0);
  }
```

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `pnpm --filter @bolao/backend test -- ranking.service.spec`
Expected: PASS — todos os testes do arquivo (existentes + 3 novos) passam.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/ranking/ranking.service.ts apps/backend/src/ranking/ranking.service.spec.ts
git commit -m "feat(ranking): calcula aproveitamento sobre o máximo possível dos jogos publicados"
```

---

## Task 2: Frontend — tipo `aproveitamento` + badge na linha do ranking

**Files:**
- Modify: `apps/frontend/src/types/api.ts` (interface `RankingEntry`, ~linhas 73-88)
- Modify: `apps/frontend/src/components/RankingRow.tsx` (bloco da pontuação, ~linhas 99-103)
- Test: `apps/frontend/src/__tests__/RankingRow.test.tsx` (fixture `entry`, ~linhas 24-30; novos testes)

- [ ] **Step 1: Adicionar o campo ao tipo**

Em `apps/frontend/src/types/api.ts`, dentro de `interface RankingEntry`, adicionar o campo logo após `apostasPostadas: number;` (linha 86):

```ts
  apostasPostadas: number;
  aproveitamento: number;
```

- [ ] **Step 2: Atualizar a fixture do teste para incluir o novo campo obrigatório**

Em `apps/frontend/src/__tests__/RankingRow.test.tsx`, na constante `entry` (linhas 24-30), adicionar `aproveitamento: 72` — substituir a linha `acertosEmpate: 1, acertosGanhador: 2, acertosNada: 0, apostasPostadas: 11,` por:

```ts
  acertosEmpate: 1, acertosGanhador: 2, acertosNada: 0, apostasPostadas: 11,
  aproveitamento: 72,
```

- [ ] **Step 3: Escrever os testes que falham**

Em `apps/frontend/src/__tests__/RankingRow.test.tsx`, adicionar ao final do arquivo:

```ts
it('exibe o badge de aproveitamento no modo geral', () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  expect(screen.getByText('72%')).toBeInTheDocument();
});

it('não exibe o badge de aproveitamento no modo rodada', () => {
  render(<RankingRow entry={entry} bolaoId="b1" posicaoRodada={1} publicacaoNumero={3} />);
  expect(screen.queryByText('72%')).not.toBeInTheDocument();
});

it('mantém a pontuação visível ao lado do badge', () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  expect(screen.getByText('55')).toBeInTheDocument(); // pontuacaoTotal
});
```

- [ ] **Step 4: Rodar os testes e ver falhar**

Run: `pnpm --filter @bolao/frontend test -- RankingRow`
Expected: FAIL — `getByText('72%')` não encontra o elemento (badge ainda não existe).

- [ ] **Step 5: Implementar o badge na linha**

Em `apps/frontend/src/components/RankingRow.tsx`, substituir o `<span>` da pontuação (linhas 99-101):

```tsx
        <span className={`text-sm font-bold tabular-nums ${isMe ? 'text-trovao-gold' : 'text-white'}`}>
          {entry.pontuacaoTotal}
        </span>
```

por uma pilha vertical alinhada à direita (pontuação maior + badge `%` abaixo, só no modo Geral):

```tsx
        <span className={`flex flex-col items-end leading-none ${isMe ? 'text-trovao-gold' : 'text-white'}`}>
          <span className="text-lg font-bold tabular-nums">{entry.pontuacaoTotal}</span>
          {!modoRodada && (
            <span className={`mt-0.5 text-[10px] font-medium tabular-nums ${
              medalha ? medalha.texto : 'text-trovao-muted'
            }`}>
              {entry.aproveitamento}%
            </span>
          )}
        </span>
```

Observações:
- `modoRodada` e `medalha` já existem no componente (linhas 34 e 36) — nenhuma nova prop.
- Altura preservada: a pilha `text-lg` (~18px) + badge `text-[10px]` com `mt-0.5` ≈ altura do avatar `w-8 h-8` (32px) dentro do `py-3` da linha; `leading-none` evita crescimento.
- O chevron (linha 103, `{expandido ? '▲' : '▼'}`) permanece inalterado, após a pilha.

- [ ] **Step 6: Rodar os testes e ver passar**

Run: `pnpm --filter @bolao/frontend test -- RankingRow`
Expected: PASS — todos os testes do arquivo passam (incluindo os existentes e os 3 novos).

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/types/api.ts apps/frontend/src/components/RankingRow.tsx apps/frontend/src/__tests__/RankingRow.test.tsx
git commit -m "feat(ranking): badge de aproveitamento na linha do ranking Geral"
```

---

## Task 3: README + verificação final

**Files:**
- Modify: `README.md` (bullet "Ranking por publicação")

- [ ] **Step 1: Atualizar o README**

Em `README.md`, no bullet do "Ranking por publicação", dentro da descrição do modo **Geral**, mencionar o aproveitamento. Localizar o trecho:

```
**Geral** (acumulado; o expand mostra a quantidade de apostas realizadas e um link para todos os palpites do usuário em rodadas publicadas)
```

e substituí-lo por:

```
**Geral** (acumulado; cada linha mostra um badge de **aproveitamento** — a pontuação do usuário como percentual do máximo possível somando os jogos já publicados, ou seja `pontos ÷ (placar exato × peso de cada jogo publicado)`; o expand mostra a quantidade de apostas realizadas e um link para todos os palpites do usuário em rodadas publicadas)
```

- [ ] **Step 2: Rodar a suíte completa dos dois pacotes**

Run: `pnpm --filter @bolao/backend test -- ranking.service.spec && pnpm --filter @bolao/frontend test -- RankingRow`
Expected: PASS em ambos.

- [ ] **Step 3: Typecheck/lint (sanidade)**

Run: `pnpm --filter @bolao/frontend lint`
Expected: sem erros novos relacionados a `RankingRow.tsx`/`api.ts`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: documenta aproveitamento no ranking Geral"
```

---

## Self-Review (cobertura do spec)

- **Denominador = máximo possível (`placar exato × peso`, jogos `publicacaoId != null`):** Task 1, Step 4 (`calcularMaxPossivel`). ✓
- **`pontosPlacarExato` lido da config (nível 1), não hardcoded:** Task 1, Step 4 + teste Step 2 (3º teste). ✓
- **`aproveitamento` inteiro arredondado, anexado por entrada, contrato `RankingEntry[]` preservado:** Task 1, Step 4 (`.map`, sem mudar o tipo de retorno para objeto). ✓
- **Edge case `maxPossivel === 0` → 0:** Task 1, Step 2 (2º teste) + Step 4 (guarda `maxPossivel > 0`). ✓
- **Escopo só modo Geral; badge oculto no modo Rodada:** Task 2, Step 5 (`{!modoRodada && ...}`) + teste Step 3 (2º teste). ✓
- **Pontuação em destaque + badge pequeno inferior direito, altura preservada:** Task 2, Step 5 (`flex flex-col items-end`, `text-lg` + `text-[10px]`, `leading-none`). ✓
- **README atualizado:** Task 3. ✓
