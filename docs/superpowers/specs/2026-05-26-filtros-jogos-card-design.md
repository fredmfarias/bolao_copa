# Design — Filtros e card da página de Jogos

**Data:** 2026-05-26
**Escopo:** `apps/frontend` (sem mudanças de backend)

## Contexto

A página de Jogos (`apps/frontend/src/app/(app)/jogos/page.tsx`) hoje filtra por
**fase** (Grupos, Oitavas, etc.) via `FaseFilterChips`, enviando `?fase=` ao backend.
O `JogoCard` exibe o placar real do jogo em destaque central, o palpite do usuário
no rodapé ("Seu palpite:") e o texto "Aposte agora" sob o placar quando a aposta
está aberta.

Queremos reorientar a página em torno do **estado de aposta** do usuário e inverter
o destaque entre palpite e placar real.

## Mudanças

### 1. Filtros por estado de aposta

As chips deixam de filtrar por fase e passam a filtrar pelo estado de aposta,
derivado no cliente a partir da aposta do usuário + prazo (a mesma lógica que o
`JogoCard` já calcula em `getEstado`).

| Filtro | Critério | Estado interno |
|---|---|---|
| **Todos** | todos os jogos | — |
| **Pendentes de aposta** | prazo aberto, sem aposta do usuário | `aberto` |
| **Apostados** | prazo aberto, com aposta do usuário | `salvo` |
| **Encerrados** | prazo encerrado (com ou sem aposta) | `fechado` + `incompleto` |

A partição é exaustiva e mutuamente exclusiva: todo jogo cai em exatamente um dos
três estados (Pendentes/Apostados/Encerrados), e "Todos" é a união.

**Comportamento:**

- **Filtragem 100% client-side.** A página carrega `GET /jogos` uma única vez (sem
  `?fase=`) e filtra em memória. O parâmetro `fase` do backend permanece, apenas
  deixa de ser usado por esta página.
- **Filtro padrão ao abrir a página: Pendentes de aposta.**
- **Ordenação:**
  - Todos / Pendentes / Apostados: crescente por data (próximos primeiro), como hoje.
  - Encerrados: **decrescente** por data (mais recente no topo). O agrupamento por
    data permanece; apenas a ordem dos grupos (e dos jogos dentro do grupo) inverte.
- O prazo é calculado como hoje: `dataHora - MINUTOS_PRAZO_APOSTA min`; encerrado quando
  `Date.now() >= prazo`.

**Componente de chips:** `FaseFilterChips` é genérico (recebe `fases`/labels). Será
renomeado para `FiltroJogosChips` e passará a receber as 4 chaves novas
(`Todos`, `Pendentes`, `Apostados`, `Encerrados`) com seus rótulos. O mapa de labels
fase-específico é substituído pelos rótulos dos novos filtros.

### 2. Redesenho do JogoCard

Inversão dos placares e exibição da data/hora da aposta.

```
GRUPOS · R1                    16:00
   🇧🇷      [ 2 : 1 ]      🇦🇷
  BRA       Palpite          ARG
        11/06/2026 13:45:25
  ───────────────────────────────
  Placar:              1 × 1   +5 pts
         [ Editar palpite ]
```

- **Centro (destaque grande):** passa a ser o **palpite do usuário**
  (`aposta.placarCasa : aposta.placarVisitante`). Sem aposta → `— : —` (o
  `ScoreDisplay` já trata `null`, basta passar os valores da aposta ou `null`).
- **Legenda "Palpite":** rótulo discreto perto do placar central, já que o número
  central mudou de significado (antes era o placar real do jogo).
- **Subtexto central** (onde estava "Aposte agora"): **data/hora da edição da
  aposta**, no formato `dd/MM/yyyy HH:mm:ss` (ex: `11/06/2026 13:45:25`), a partir de
  `aposta.atualizadoEm`. Aparece apenas quando existe aposta.
- **"Aposte agora" removido.** O botão de apostar continua disponível, com os rótulos
  atuais ("Apostar" para `aberto`, "Editar palpite" para `salvo`).
- **Rodapé relabelado "Placar:"** exibe o **resultado real do jogo**
  (`jogo.placarCasa × jogo.placarVisitante`), apenas quando o admin já lançou o placar
  (`!== null`). O selo `+X pts` permanece no rodapé quando `aposta.pontuacao !== null`.
- **Jogos encerrados sem aposta** (`incompleto`): o texto "Prazo encerrado — sem
  aposta" é removido; o `— : —` central já comunica a ausência de palpite, e a borda
  dourada continua sinalizando a aposta perdida.

### 3. Tipo `Aposta` (frontend)

Adicionar o campo `atualizadoEm: string` à interface `Aposta` em
`apps/frontend/src/types/api.ts`. O backend (Prisma `Aposta.atualizadoEm @updatedAt`)
já retorna o campo em `GET /apostas`; falta apenas tipá-lo no frontend. Nenhuma
mudança de backend é necessária.

## Arquivos afetados

- `apps/frontend/src/app/(app)/jogos/page.tsx` — filtros, carga única de jogos,
  filtragem e ordenação client-side.
- `apps/frontend/src/components/FaseFilterChips.tsx` → `FiltroJogosChips.tsx` —
  rótulos dos novos filtros.
- `apps/frontend/src/components/JogoCard.tsx` — inversão palpite/placar, data/hora,
  remoção de "Aposte agora".
- `apps/frontend/src/types/api.ts` — campo `atualizadoEm` em `Aposta`.
- Testes: `FaseFilterChips.test.tsx` (renomear/atualizar) e `JogoCard.test.tsx`.

## Fora de escopo

- Nenhuma mudança de backend, banco ou API.
- Drawer de aposta (`ApostaDrawer`) permanece inalterado.

## Testes

- `JogoCard`: placar central reflete o palpite; `— : —` sem aposta; data/hora
  formatada quando há aposta; rodapé "Placar" só com resultado lançado; ausência de
  "Aposte agora"; botão presente em `aberto`/`salvo`.
- Filtros: cada estado classifica os jogos corretamente; ordenação decrescente em
  Encerrados e crescente nos demais; filtro padrão Pendentes.
