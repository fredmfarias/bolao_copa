# Ranking Geral — palpites do usuário no accordion

**Data:** 2026-06-12
**Branch:** `feat/ranking-geral-palpites-usuario`

## Objetivo

No accordion do ranking **Geral**, ao expandir a linha de um usuário, permitir:

1. Ver a **quantidade de apostas realizadas** por aquele usuário.
2. Acessar, via **link**, uma tela dedicada com **todos os palpites** do usuário,
   restritos a jogos cujas apostas já encerraram — agrupados por rodada/publicação.

Semelhante ao que a aba **Rodada** já mostra inline, porém abrangendo todas as
rodadas publicadas (não uma única) e em uma tela própria.

## Validação de segurança (contexto)

Foram auditados os dois caminhos que expõem palpites de outros usuários:

- `GET /boloes/:bolaoId/apostas?jogoId=` → `ApostaService.listarPalpitesPorJogo`
  (`aposta.service.ts:67`): **já protegido no servidor** — calcula o prazo
  (`dataHora − MINUTOS_PRAZO_APOSTA`) e lança `ForbiddenException` se
  `agora < prazo`. A checagem no frontend é apenas UX.
- `GET /boloes/:bolaoId/ranking/publicacoes/:numero/usuarios/:usuarioId/apostas`
  → `RankingService.palpitesDaRodada` (`ranking.service.ts:94`): **protegido apenas
  por convenção** — devolve os jogos vinculados a uma `publicacao`, sem checagem
  de prazo por jogo. Se uma rodada fosse publicada antes do encerramento das
  apostas, os palpites vazariam.

Esta lacuna é corrigida como parte deste trabalho (ver §1).

## Decisões de design (do brainstorming)

- **Apresentação:** página dedicada acessada por link no accordion (não inline).
- **Organização da tela:** agrupada por rodada/publicação, mais recente primeiro.
- **Escopo:** apenas rodadas já publicadas; o backend ainda filtra cada jogo por
  prazo encerrado por segurança.

## Arquitetura

### 1. Backend — novo endpoint + correção de segurança

**Novo endpoint:** `GET /boloes/:bolaoId/ranking/usuarios/:usuarioId/apostas`

Retorna os palpites do usuário agrupados por publicação, da mais recente para a
mais antiga:

```ts
type UsuarioPalpitesRodada = {
  publicacao: { numero: number; publicadoEm: string };
  items: RodadaPalpiteItem[];
};
// resposta: UsuarioPalpitesRodada[]
```

Implementação em `RankingService`:

- Extrair um helper privado `montarPalpitesDaPublicacao(publicacaoId, usuarioId)`
  a partir da lógica hoje embutida em `palpitesDaRodada`. Esse helper:
  - busca os jogos da publicação (com seleções, peso, placares);
  - **filtra cada jogo por prazo encerrado** (`agora ≥ dataHora −
    MINUTOS_PRAZO_APOSTA`) — esta é a correção de segurança;
  - mapeia para `RodadaPalpiteItem[]` (palpite + pontuação).
- `palpitesDaRodada` passa a chamar o helper (mantém assinatura e comportamento,
  agora com filtro de prazo).
- O novo método `palpitesDoUsuario(bolaoId, usuarioId)`:
  - lista as publicações do bolão (mesma fonte de `listarPublicacoes`);
  - para cada uma, chama o helper e monta `{ publicacao, items }`;
  - omite seções cujo `items` ficou vazio após o filtro de prazo.

Rota no `RankingController`:

```ts
@Get('usuarios/:usuarioId/apostas')
palpitesDoUsuario(
  @Param('bolaoId') bolaoId: string,
  @Param('usuarioId') usuarioId: string,
) {
  return this.service.palpitesDoUsuario(bolaoId, usuarioId);
}
```

Protegido por `JwtAuthGuard` (já aplicado no controller).

### 2. Frontend — accordion do Geral (`RankingRow.tsx`)

No modo geral (`!modoRodada`), ao expandir, além do breakdown de acertos e do
gráfico de evolução já existentes, adicionar:

- **Linha "Apostas realizadas: N"** — usa `entry.apostasPostadas`, já presente em
  `RankingEntry` (sem nova chamada de API).
  - Nota semântica: `apostasPostadas` conta apostas **já pontuadas** (jogos
    encerrados/publicados), não apostas em jogos futuros — consistente com o
    contexto de ranking.
- **Link "Ver palpites →"** (`next/link`) para a nova rota dedicada do usuário.

### 3. Frontend — nova tela dedicada

Rota: `app/(app)/ranking/[bolaoId]/usuarios/[usuarioId]/palpites/page.tsx`

- Busca `GET /boloes/:bolaoId/ranking/usuarios/:usuarioId/apostas`.
- Cabeçalho com nome/avatar do usuário e link "← Voltar" para o ranking do bolão.
- Uma seção por rodada/publicação (rótulo com data da publicação), cada uma
  renderizando o componente existente `RankingPalpitesRodada` com `items`.
- `PageSkeleton` durante o carregamento; `EmptyState` quando não há rodadas
  publicadas com palpites visíveis.

### 4. Tipos e testes

- `api.ts`: adicionar `UsuarioPalpitesRodada`.
- `ranking.service.spec.ts`: testes do novo método e do helper, cobrindo o
  **filtro de prazo** (jogo com apostas abertas não aparece) e o agrupamento.
- Teste de componente da nova tela (render das seções + empty state).
- Atualizar o `README.md` com a regra de visibilidade de palpites por prazo e a
  nova tela.

## Fluxo de dados

```
RankingPage (Geral)
  └─ RankingRow (expandido)
       ├─ "Apostas realizadas: N"      ← entry.apostasPostadas (já carregado)
       └─ Link "Ver palpites →"        ← /ranking/[bolaoId]/usuarios/[usuarioId]/palpites
            └─ nova página
                 GET /boloes/:id/ranking/usuarios/:usuarioId/apostas
                   └─ RankingService.palpitesDoUsuario
                        └─ por publicação: montarPalpitesDaPublicacao (filtra prazo)
                 render: seções por publicação → RankingPalpitesRodada
```

## Tratamento de erros

- Endpoint retorna `[]` quando não há publicações; a tela mostra `EmptyState`.
- Falha de rede na tela dedicada → `EmptyState` / lista vazia (padrão das telas
  existentes com `.catch(() => [])`).
- Jogo sem aposta do usuário → `palpite: null` (já tratado em `RodadaPalpiteItem`).

## Fora de escopo (YAGNI)

- Não adicionar link/contagem na aba Rodada (já mostra palpites inline).
- Não paginar a tela dedicada — o volume de rodadas publicadas é pequeno.
- Não alterar o cálculo de `apostasPostadas`.
