# Aproveitamento por usuário no ranking Geral

**Data:** 2026-06-22
**Branch:** _(nova branch antes de implementar)_

## Objetivo

Na tela de ranking, no modo **Geral**, exibir o **aproveitamento** de cada usuário:
o percentual da pontuação que ele fez em relação ao **máximo possível** que daria
para fazer nos jogos já publicados.

Exemplo: se o máximo possível somando todos os jogos publicados é 100 pontos e o
usuário fez 20, o aproveitamento é **20%**.

## Decisões de design (do brainstorming)

- **Denominador = máximo possível** (não relativo ao líder). Ninguém chega a 100%
  a não ser que tenha gabaritado (placar exato) em todos os jogos publicados.
- **Escopo:** apenas o modo **Geral** (acumulado). No modo Rodada o badge não aparece.
- **Numerador:** `pontuacaoTotal` do snapshot (acumulado).
- **Denominador:** soma de `pontosPlacarExato × pesoPontuacao` sobre todos os jogos
  com `publicacaoId != null`.
- **Cálculo no backend**, anexado por entrada (mantém o contrato `RankingEntry[]`).
- **Apresentação:** pontuação em destaque (maior) e um badge pequeno de `%` no canto
  inferior direito da linha, **sem alterar a altura atual** da linha.

## Por que `publicacaoId != null` (e não "jogos com placar")

Garante que o denominador cubra exatamente o mesmo conjunto de jogos que alimentou o
`pontuacaoTotal` do snapshot. Jogos encerrados mas ainda não publicados não contam
nem para a pontuação nem para o máximo possível — `publicar()` só vincula
`publicacaoId` a jogos já encerrados, então todo jogo publicado tem resultado e o
máximo é bem definido.

## Arquitetura

### Backend — `RankingService.obterRanking(bolaoId, numero?)`

`apps/backend/src/ranking/ranking.service.ts`

1. Após buscar os snapshots (lógica atual inalterada), calcular **uma vez** o máximo
   possível:

   ```
   pontosPlacarExato = ConfiguracaoPontuacao.pontos onde nivel = 1   (hoje 10)
   maxPossivel = Σ (pontosPlacarExato × jogo.pesoPontuacao)
                 para todo Jogo com publicacaoId != null
   ```

   - `pontosPlacarExato` é lido do banco (não hardcoded) para respeitar a config.
   - O denominador é **global e idêntico para todos** os usuários e bolões (jogos e
     publicações são entidades globais) → 1 cálculo por requisição.

2. Para cada snapshot, anexar:

   ```
   aproveitamento = maxPossivel > 0
     ? Math.round((pontuacaoTotal / maxPossivel) * 100)
     : 0
   ```

   Valor inteiro em pontos percentuais (ex.: `20`).

3. Retornar os itens com o novo campo `aproveitamento`. O retorno continua sendo uma
   lista (não muda o contrato dos callers que esperam `RankingEntry[]`).

### Frontend

**Tipo** — `apps/frontend/src/types/api.ts`: adicionar `aproveitamento: number` em
`RankingEntry`.

**`RankingRow.tsx`** — bloco direito da linha fechada:

- A pontuação (`pontuacaoTotal`) passa de `text-sm` para um tamanho maior
  (ex.: `text-lg`/`text-xl`, `leading-none`).
- Abaixo dela, alinhado à direita, um badge pequeno (`text-[10px]`/`[11px]`) com o
  percentual: `72%`. Cor `text-trovao-muted` (ou cor da medalha para os 5 primeiros,
  mantendo coerência visual).
- Os dois ficam num `flex flex-col items-end`.
- **Altura preservada:** a linha mantém `py-3`; a pilha "número grande + badge
  minúsculo" ocupa aproximadamente a mesma altura que o número `text-sm` ocupava.
  O `leading` é ajustado para não crescer.
- A seta de variação (`posicoesGanhas`) e o chevron permanecem onde estão.
- **Só no modo Geral:** o badge é renderizado apenas quando `!modoRodada`. No modo
  Rodada a pontuação exibida é a da rodada, e o aproveitamento não se aplica.

## Edge cases

- **Sem publicações:** `obterRanking` já retorna `[]`; nada a exibir.
- **`maxPossivel === 0`** (ex.: todos os jogos publicados com peso 0): `aproveitamento = 0`,
  sem divisão por zero.
- **Líder < 100%:** esperado no modelo de máximo possível; 100% só com gabarito total.

## Testes

- **Backend** (`ranking.service.spec.ts`):
  - `obterRanking` calcula `maxPossivel` corretamente com pesos variados e anexa
    `aproveitamento` arredondado.
  - `maxPossivel = 0` → `aproveitamento = 0`.
  - Respeita o `pontos` do nível 1 vindo da `ConfiguracaoPontuacao`.
- **Frontend** (`RankingRow.test.tsx`):
  - Renderiza o badge `%` no modo Geral.
  - **Não** renderiza o badge no modo Rodada.
  - Mostra a pontuação em destaque.

## Documentação

Atualizar o README na descrição do "Ranking por publicação", mencionando o
aproveitamento no modo Geral (regra de negócio nova).
