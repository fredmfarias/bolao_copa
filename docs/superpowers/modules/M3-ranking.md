# M3 — Ranking

> **Spec:** [`2026-05-23-frontend-maduro-design.md`](../specs/2026-05-23-frontend-maduro-design.md#camada-3--ranking)
> **Depende de:** [M1 — Fundação](./M1-fundacao.md), [`contracts/aposta-drawer.md`](../contracts/aposta-drawer.md)
> **Produz contratos:** [`contracts/ranking.md`](../contracts/ranking.md)
> **Status:** `pendente`

---

## Contexto mínimo para esta sessão

Carregar antes de começar:
- [ ] [`context/stack.md`](../context/stack.md)
- [ ] [`context/visual-tokens.md`](../context/visual-tokens.md)
- [ ] [`context/backend-gaps.md`](../context/backend-gaps.md)
- [ ] [`contracts/aposta-drawer.md`](../contracts/aposta-drawer.md)

---

## Escopo

**Dentro:**
- Criar `RankingPodium` (top 3 com destaque visual)
- Criar `RankingRow` com Accordion (expande para mostrar estatísticas)
- Criar `ApostasDialog` — modal com palpites de todos para um jogo
- Criar tela `/palpites/[jogoId]` — view de palpites por jogo
- Estado "aguardando publicação" quando ranking ainda não foi publicado

**Fora:**
- Não implementar publicação (M4)
- Não mostrar variação de posição (`posicoesGanhas`) até M4 publicar o ranking
- Não criar admin (M4)

---

## Arquivos afetados

| Ação | Caminho |
|---|---|
| Reescrever | `apps/frontend/src/components/RankingTable.tsx` → separar em `RankingPodium.tsx` + `RankingRow.tsx` |
| Modificar | `apps/frontend/src/app/(app)/ranking/[bolaoId]/page.tsx` |
| Criar | `apps/frontend/src/components/RankingPodium.tsx` |
| Criar | `apps/frontend/src/components/RankingRow.tsx` |
| Criar | `apps/frontend/src/components/ApostasDialog.tsx` |
| Criar | `apps/frontend/src/app/(app)/palpites/[jogoId]/page.tsx` |

---

## Tickets

- [ ] [T301 — RankingPodium (top 3)](../tickets/T301-ranking-podium.md)
- [ ] [T302 — RankingRow com Accordion e estatísticas](../tickets/T302-ranking-row.md)
- [ ] [T303 — ApostasDialog e tela de palpites por jogo](../tickets/T303-apostas-dialog.md)
- [ ] [T304 — Estado "aguardando publicação" na tela de ranking](../tickets/T304-ranking-aguardando.md)

---

## Critério de conclusão

- [ ] Todos os tickets acima marcados como concluídos
- [ ] `pnpm build --filter frontend` passa sem erros de tipo
- [ ] Tela de ranking exibe pódio + lista, expande estatísticas ao clicar
- [ ] Tela de palpites mostra quem apostou o quê em cada jogo
- [ ] Contrato `ranking.md` escrito
- [ ] `INDEX.md` atualizado com status `concluído`

---

## Resumo operacional

M3 transforma a tela de ranking de uma tabela simples para uma experiência completa com pódio, accordion e visualização de palpites. Também implementa o estado de "aguardando publicação" que M4 desbloqueará. Produz o contrato que M4 (admin) precisa para exibir preview do draft.
