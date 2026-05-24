# Bolão Trovão — Frontend Maduro · Índice

> Leia este arquivo primeiro. Carregue APENAS os arquivos listados em "Contexto mínimo" da camada ativa.

---

## Status dos módulos

| Módulo | Descrição | Status | Contratos produzidos |
|---|---|---|---|
| [M1 — Fundação](./modules/M1-fundacao.md) | shadcn/ui, tokens, hooks base, BottomNav | `concluído` | — |
| [M2 — Apostas](./modules/M2-apostas.md) | JogoCard, ApostaDrawer, auto-save | `pendente` | jogo-card, aposta-drawer |
| [M3 — Ranking](./modules/M3-ranking.md) | Pódio, accordion, palpites, draft state | `pendente` | ranking |
| [M4 — Admin](./modules/M4-admin.md) | Placares, ranking admin, usuários | `pendente` | admin |
| [M5 — Bolão/Convite](./modules/M5-bolao-convite.md) | Link de convite, landing, moderador | `pendente` | convite |

---

## Contexto permanente

| Arquivo | Quando carregar |
|---|---|
| [`context/stack.md`](./context/stack.md) | Sempre, no início da sessão |
| [`context/visual-tokens.md`](./context/visual-tokens.md) | Sempre que criar/modificar componentes visuais |
| [`context/routes.md`](./context/routes.md) | Sempre que criar rotas ou layouts |
| [`context/backend-gaps.md`](./context/backend-gaps.md) | Sempre que integrar com a API |

---

## Contratos disponíveis

| Contrato | Produzido após | Necessário para |
|---|---|---|
| [`contracts/jogo-card.md`](./contracts/jogo-card.md) | M2 concluído | M3 |
| [`contracts/aposta-drawer.md`](./contracts/aposta-drawer.md) | M2 concluído | M3 |
| [`contracts/ranking.md`](./contracts/ranking.md) | M3 concluído | M4 |
| [`contracts/admin.md`](./contracts/admin.md) | M4 concluído | M5 |
| [`contracts/convite.md`](./contracts/convite.md) | M5 concluído | — |

---

## Referências

- **Spec completa:** [`specs/2026-05-23-frontend-maduro-design.md`](./specs/2026-05-23-frontend-maduro-design.md)
- **Arquitetura documental:** [`plans/2026-05-23-doc-architecture.md`](./plans/2026-05-23-doc-architecture.md)
- **Templates:** [`templates/`](./templates/)
