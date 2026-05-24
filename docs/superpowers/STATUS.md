# Status da Implementação

> Este é o único arquivo que precisa ser lido para saber onde retomar.
> Atualizar ao fim de cada sessão.

---

## Posição atual

| Campo | Valor |
|---|---|
| **Módulo ativo** | M2 — Apostas |
| **Ticket ativo** | — |
| **Próxima ação** | Escrever contratos jogo-card.md e aposta-drawer.md, depois Fase A M3 |

---

## Progresso dos módulos

| Módulo | Status | Tickets |
|---|---|---|
| M1 — Fundação | `concluído` | 5 / 5 criados · 5 / 5 concluídos |
| M2 — Apostas | `concluído` | 3 / 3 criados · 3 / 3 concluídos |
| M3 — Ranking | `aguardando M2` | — |
| M4 — Admin | `aguardando M3` | — |
| M5 — Bolão/Convite | `aguardando M4` | — |

---

## Última sessão

**Data:** 2026-05-24  
**O que foi feito:** M2 concluído — T201 (JogoCard 4 estados), T202 (ApostaDrawer + Sheet shadcn), T203 (FaseFilterChips + jogos/page agrupada por data + load paralelo apostas). Fix: `moduleNameMapper` para `@bolao/shared` no jest.config.ts. 36 testes passando.  
**Próximo:** escrever contratos jogo-card.md e aposta-drawer.md → Fase A M3
