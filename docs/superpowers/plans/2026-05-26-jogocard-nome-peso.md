# Nome da Seleção e Destaque de Peso no JogoCard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ao `JogoCard` um título com os nomes completos das seleções ("Brasil × Argentina") e um badge de peso (`×N`) sempre visível, com destaque dourado quando o peso é maior que 1.

**Architecture:** Mudança isolada no componente `JogoCard`. Os dados (`selecao.nome`, `pesoPontuacao`) já existem no tipo `Jogo`; nenhuma mudança de backend/tipos. Estilização via tokens `trovao-*` do design system.

**Tech Stack:** React 18, TypeScript, Jest + Testing Library, Tailwind.

**Spec:** `docs/superpowers/specs/2026-05-26-jogocard-nome-peso-design.md`

---

## Task 1: Título com nomes e badge de peso

**Files:**
- Modify: `apps/frontend/src/components/JogoCard.tsx`
- Modify: `apps/frontend/src/__tests__/JogoCard.test.tsx`

- [ ] **Step 1: Adicionar os testes que falham**

Acrescentar os testes abaixo ao final de `apps/frontend/src/__tests__/JogoCard.test.tsx` (o fixture `jogoBase` tem `pesoPontuacao: 1` e seleções Brasil/Argentina; o `selecao('Brasil')` gera `codigo` "BRA" e `selecao('Argentina')` gera "ARG"):

```tsx
it('exibe título com nomes completos das seleções', () => {
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA }} onApostar={jest.fn()} />);
  expect(screen.getByText('Brasil × Argentina')).toBeInTheDocument();
});

it('mantém as siglas sob os avatares', () => {
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA }} onApostar={jest.fn()} />);
  expect(screen.getByText('BRA')).toBeInTheDocument();
  expect(screen.getByText('ARG')).toBeInTheDocument();
});

it('peso 1 — badge ×1 discreto (muted, sem destaque dourado)', () => {
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA, pesoPontuacao: 1 }} onApostar={jest.fn()} />);
  const badge = screen.getByText('×1');
  expect(badge.className).toMatch(/trovao-muted/);
  expect(badge.className).not.toMatch(/trovao-gold/);
});

it('peso > 1 — badge ×2 com destaque dourado', () => {
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA, pesoPontuacao: 2 }} onApostar={jest.fn()} />);
  const badge = screen.getByText('×2');
  expect(badge.className).toMatch(/trovao-gold/);
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `pnpm --filter @bolao/frontend test -- JogoCard.test`
Expected: FAIL — "Brasil × Argentina" e "×1"/"×2" não encontrados.

- [ ] **Step 3: Implementar título e badge no JogoCard**

Em `apps/frontend/src/components/JogoCard.tsx`, substituir o bloco do header (atualmente):

```tsx
      {/* Header */}
      <div className="flex justify-between items-center text-xs text-trovao-muted">
        <span>{jogo.fase}{jogo.grupo ? ` · Grupo ${jogo.grupo}` : ''} · R{jogo.rodada}</span>
        <span>{formatHora(jogo.dataHora)}</span>
      </div>
```

por:

```tsx
      {/* Título */}
      <p className="text-sm font-semibold text-white text-center">
        {jogo.selecaoCasa.nome} × {jogo.selecaoVisitante.nome}
      </p>

      {/* Header */}
      <div className="flex justify-between items-center text-xs text-trovao-muted">
        <span>{jogo.fase}{jogo.grupo ? ` · Grupo ${jogo.grupo}` : ''} · R{jogo.rodada}</span>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              jogo.pesoPontuacao > 1
                ? 'bg-trovao-gold text-trovao-base'
                : 'bg-trovao-surface text-trovao-muted'
            }`}
          >
            ×{jogo.pesoPontuacao}
          </span>
          <span>{formatHora(jogo.dataHora)}</span>
        </div>
      </div>
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `pnpm --filter @bolao/frontend test -- JogoCard.test`
Expected: PASS (testes novos + os 6 existentes do JogoCard).

- [ ] **Step 5: Typecheck**

Run: `cd apps/frontend && pnpm exec tsc --noEmit`
Expected: sem erros (exit 0).

- [ ] **Step 6: Verificação manual no navegador**

1. Subir o app (`pnpm dev`) e abrir a página de Jogos.
2. Confirmar em cada card: título "Casa × Visitante" centralizado no topo; siglas mantidas sob os avatares; badge `×1` discreto (muted) nos jogos de peso 1.
3. (Se houver jogo com peso > 1, ex.: eliminatórias cadastradas via admin) confirmar o badge `×N` em dourado.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/components/JogoCard.tsx apps/frontend/src/__tests__/JogoCard.test.tsx
git commit -m "feat: título com nomes das seleções e badge de peso no card de jogo"
```

---

## Self-Review (preenchido pelo autor do plano)

- **Cobertura do spec:** título com nomes completos (Step 3 + teste Step 1); siglas mantidas (teste Step 1); badge `×N` sempre visível com peso 1 muted e peso > 1 dourado (Step 3 + testes Step 1). Todos os itens do spec têm cobertura.
- **Placeholders:** nenhum — todo passo de código mostra o código completo.
- **Consistência:** o campo `jogo.pesoPontuacao` e `jogo.selecaoCasa/Visitante.nome` já existem no tipo `Jogo`; classes `trovao-gold`/`trovao-muted`/`trovao-surface`/`trovao-base` são tokens existentes no `tailwind.config.ts`. O separador `×` é o mesmo do rodapé "Placar".
