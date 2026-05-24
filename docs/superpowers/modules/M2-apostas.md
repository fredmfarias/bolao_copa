# M2 — Apostas

> **Spec:** [`2026-05-23-frontend-maduro-design.md`](../specs/2026-05-23-frontend-maduro-design.md#camada-2--apostas)
> **Depende de:** [M1 — Fundação](./M1-fundacao.md)
> **Produz contratos:** [`contracts/jogo-card.md`](../contracts/jogo-card.md), [`contracts/aposta-drawer.md`](../contracts/aposta-drawer.md)
> **Status:** `concluído`

---

## Contexto mínimo para esta sessão

Carregar antes de começar:
- [ ] [`context/stack.md`](../context/stack.md)
- [ ] [`context/visual-tokens.md`](../context/visual-tokens.md)
- [ ] [`context/backend-gaps.md`](../context/backend-gaps.md)

---

## Escopo

**Dentro:**
- Reescrever `JogoCard` com 4 estados visuais: aberto / salvo / incompleto / fechado
- Criar `ApostaDrawer` (Sheet do shadcn/ui) com stepper de times
- Agrupar lista de jogos por data com sticky headers
- Chips de filtro horizontal por fase (Grupos, Oitavas, Quartas…)
- Auto-save ao fechar o drawer

**Fora:**
- Não calcular pontuação no frontend
- Não mostrar palpites de outros usuários (M3)
- Não criar admin de placares (M4)

---

## Arquivos afetados

| Ação | Caminho |
|---|---|
| Reescrever | `apps/frontend/src/components/JogoCard.tsx` |
| Reescrever | `apps/frontend/src/components/ApostaForm.tsx` → renomear para `ApostaDrawer.tsx` |
| Modificar | `apps/frontend/src/app/(app)/jogos/page.tsx` |
| Criar | `apps/frontend/src/components/FaseFilterChips.tsx` |

---

## Tickets

- [x] [T201 — JogoCard com 4 estados visuais](../tickets/T201-jogo-card.md)
- [x] [T202 — ApostaDrawer com stepper](../tickets/T202-aposta-drawer.md)
- [x] [T203 — Lista de jogos agrupada por data com chips de filtro](../tickets/T203-jogos-lista.md)

---

## Critério de conclusão

- [ ] Todos os tickets acima marcados como concluídos
- [ ] `pnpm build --filter frontend` passa sem erros de tipo
- [ ] Usuário consegue abrir um jogo, preencher placar e ver o card mudar para estado "salvo"
- [ ] Contratos `jogo-card.md` e `aposta-drawer.md` escritos
- [ ] `INDEX.md` atualizado com status `concluído`

---

## Resumo operacional

M2 transforma a experiência de apostas: JogoCard passa a refletir visualmente o estado de cada aposta, ApostaDrawer oferece uma experiência fluida com stepper e auto-save. Produz os contratos que M3 (ranking/palpites) precisa para renderizar palpites corretamente.
