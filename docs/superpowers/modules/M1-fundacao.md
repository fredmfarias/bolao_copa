# M1 — Fundação

> **Spec:** [`2026-05-23-frontend-maduro-design.md`](../specs/2026-05-23-frontend-maduro-design.md#camada-1--fundação)
> **Depende de:** nada
> **Produz contratos:** nenhum (fundação interna)
> **Status:** `pendente`

---

## Contexto mínimo para esta sessão

Carregar antes de começar:
- [ ] [`context/stack.md`](../context/stack.md)
- [ ] [`context/visual-tokens.md`](../context/visual-tokens.md)
- [ ] [`context/routes.md`](../context/routes.md)

---

## Escopo

**Dentro:**
- Instalar e configurar shadcn/ui
- Atualizar `tailwind.config.ts` e `globals.css` com tokens `trovao-*`
- Criar `BottomNav` e atualizar `AppLayout`
- Criar hooks base: `useAutoSave`, `useAdmin`, `useModerador`
- Criar componentes base: `SelecaoAvatar`, `ScoreDisplay`, `PageSkeleton`, `EmptyState`

**Fora:**
- Não implementar lógica de negócio (apostas, ranking, admin)
- Não criar rotas novas além de ajustar o layout existente
- Não integrar com API (apenas contratos de props)

---

## Arquivos afetados

| Ação | Caminho |
|---|---|
| Modificar | `apps/frontend/tailwind.config.ts` |
| Modificar | `apps/frontend/src/app/globals.css` |
| Modificar | `apps/frontend/src/app/(app)/layout.tsx` |
| Criar | `apps/frontend/src/components/BottomNav.tsx` |
| Criar | `apps/frontend/src/components/SelecaoAvatar.tsx` |
| Criar | `apps/frontend/src/components/ScoreDisplay.tsx` |
| Criar | `apps/frontend/src/components/PageSkeleton.tsx` |
| Criar | `apps/frontend/src/components/EmptyState.tsx` |
| Criar | `apps/frontend/src/hooks/useAutoSave.ts` |
| Criar | `apps/frontend/src/hooks/useAdmin.ts` |
| Criar | `apps/frontend/src/hooks/useModerador.ts` |

---

## Tickets

- [ ] [T101 — Instalar shadcn/ui e aplicar tokens visuais](../tickets/T101-shadcn-tokens.md)
- [ ] [T102 — BottomNav + atualizar AppLayout](../tickets/T102-bottom-nav.md)
- [ ] [T103 — Componentes base: PageSkeleton e EmptyState](../tickets/T103-skeleton-empty.md)
- [ ] [T104 — Componentes base: SelecaoAvatar e ScoreDisplay](../tickets/T104-avatar-score.md)
- [ ] [T105 — Hooks base: useAutoSave, useAdmin, useModerador](../tickets/T105-hooks.md)

---

## Critério de conclusão

- [ ] Todos os tickets acima marcados como concluídos
- [ ] `pnpm build --filter frontend` passa sem erros de tipo
- [ ] Página `/jogos` renderiza com fundo `#071A0E` e BottomNav visível no rodapé
- [ ] Contratos produzidos por esta camada: nenhum
- [ ] `INDEX.md` atualizado com status `concluído`

---

## Resumo operacional

M1 instala o shadcn/ui, aplica os tokens visuais `trovao-*`, substitui o NavBar pelo BottomNav mobile-first e cria os blocos de construção (hooks + componentes base) usados por todos os módulos seguintes. Sem M1 nenhum outro módulo pode ser implementado.
