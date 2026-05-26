# Correção do ranking — posição 0 e desempate alfabético

**Data:** 2026-05-26
**Tipo:** Correção de bug

## Problema

Usuários que nunca apostaram (ou cujas apostas ainda não foram pontuadas) aparecem
com `posicao = 0` e, por isso, no **topo** do ranking.

### Causa raiz

1. Ao criar/entrar num bolão — e no cadastro, para o bolão global — uma linha
   `Ranking` é criada com `posicao` no default `0` (`schema.prisma:186`):
   - `apps/backend/src/bolao/bolao.service.ts:26` (criar)
   - `apps/backend/src/bolao/bolao.service.ts:128` (entrar)
   - `apps/backend/src/auth/auth.service.ts:31` e `auth.controller.ts:92` (bolão global no cadastro)
2. `recalcularRankingBolao` (`ranking.service.ts:94`) só itera usuários com apostas
   pontuadas (`pontuacao: { not: null }`). Quem nunca pontuou jamais tem a `posicao`
   recalculada e permanece em `0`.
3. `publicacao.service.ts:55` (e o preview admin) lê todas as linhas `Ranking`
   ordenando por `posicao asc`, então os de `posicao = 0` sobem para o topo.

Além disso, o critério de desempate final por **ordem alfabética do nome** pedido na
regra de negócio não existe hoje no `comparadorRanking`.

## Comportamento desejado

- Toda aposta não realizada gera pontuação 0.
- Apenas usuários **ativos** (`Usuario.ativo = true`) são rankeados.
- Todos os membros ativos do bolão aparecem no ranking; quem não apostou fica no **fundo**,
  ordenado pelos critérios de desempate (incluindo alfabético).
- A posição é recalculada a cada rodada (já ocorre via `recalcularRankingBolao`).
- Ordem de desempate (decrescente, exceto o último):
  1. Pontuação total
  2. Placar exato (`acertosPlacarExato`)
  3. Placar do vencedor correto (`acertosPlacarVencedor`)
  4. Empate correto sem placar exato (`acertosEmpate`)
  5. Placar do perdedor correto (`acertosPlacarPerdedor`)
  6. Acertou apenas o vencedor (`acertosGanhador`)
  7. Ordem alfabética crescente do nome do usuário

## Mudanças

### 1. `recalcularRankingBolao` semeia apenas membros ativos (`ranking.service.ts:94`)

- Buscar membros do bolão filtrando `usuario: { ativo: true }`, trazendo `usuarioId` e `nome`.
- Inicializar o map `porUsuario` com **uma entrada zerada por membro ativo**, carregando o `nome`.
- As apostas pontuadas acumulam por cima das entradas já existentes.
- Após os upserts, **remover linhas `Ranking` de membros não-ativos** desse bolão
  (`deleteMany` onde `usuarioId notIn` o conjunto ativo). Isso garante que um usuário
  desativado — que já tinha linha criada no join — deixe de aparecer no snapshot, já
  que `publicacao.service.ts:55` lê todas as linhas do bolão.
- Resultado: todo membro ativo recebe linha com posição calculada; não-apostadores ficam
  com tudo 0 e caem para o fundo; inativos somem do ranking.

### 2. Desempate alfabético final (`comparadorRanking`, `ranking.service.ts:149`)

- Manter a ordem das 6 categorias atuais (já corresponde à regra).
- Acrescentar critério final: `a.nome.localeCompare(b.nome)` (crescente).
- O map precisa carregar `nome` (vindo da mudança 1).

### 3. Sem alteração de schema

O default `posicao = 0` permanece como estado inicial até o primeiro recalc; com a
mudança 1 ele deixa de aparecer indevidamente no ranking.

## Escopo de dados

**Fix-forward apenas.** Snapshots de publicações já existentes (com `posicao = 0`)
permanecem como estão. A correção passa a valer a partir da próxima publicação /
próximo recálculo.

## Testes (`ranking.service.spec.ts`)

- Membro sem nenhuma aposta recebe posição no fim, não no topo.
- Desempate alfabético entre dois usuários com estatísticas idênticas.
- Ordem das 6 categorias de desempate preservada.
- Membro com apostas pontuadas continua somando corretamente sobre a entrada semeada.
- Usuário inativo não aparece no ranking, e sua linha `Ranking` é removida no recalc.

## Fora de escopo

- Backfill de snapshots históricos.
- Remoção da criação eager da linha `Ranking` no join/cadastro.
- Mudanças de UI no frontend (ordenação já vem pronta do backend).
