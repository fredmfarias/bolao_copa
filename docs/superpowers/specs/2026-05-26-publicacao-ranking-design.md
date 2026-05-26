# Publicação Global e Ranking com Variação — Design

> **Data:** 2026-05-26
> **Status:** aprovado para planejamento
> **Stack:** NestJS + Prisma + PostgreSQL (backend), Next.js 14 + React + Tailwind + shadcn (frontend), Jest (testes)

## Objetivo

Formalizar o modelo de **publicação de ranking** do bolão, atendendo às regras de personas, apostas, placar e ranking. O coração do trabalho é o ciclo de publicação global e os dois tipos de ranking (geral e por publicação), com variação de posição e gráfico de evolução do participante ao longo das rodadas.

## Estado atual vs regras (recap)

**Já implementado e alinhado:**
- Apostas globais (1 aposta por jogo, vale para todos os bolões) com prazo de 1h antes do jogo.
- Placar editável apenas por ADMIN (`PATCH /jogos/:id/placar`), com recálculo de pontuação (`RankingService.recalcularParaJogo`).
- Personas: enum `Role` (ADMIN/USER); moderador de bolão (add/remover/promover membros); criar/listar bolão.

**Gaps que este design resolve:**
1. Variação de posição (subiu/caiu vs publicação anterior) — não existe.
2. Dois tipos de ranking (geral vs publicação) — só há um ranking acumulado.
3. Publicação como evento (admin decide quando os resultados ficam visíveis) — hoje `publicarRanking` é stub que só muda status para `PAGO`.
4. Habilitar/desabilitar bolões privados — formalizado via status do bolão.
5. Gráfico de evolução de posição do participante ao longo das rodadas.
6. Gestão de usuários pelo admin: ativar/desativar e resetar senha.

**Gestão de usuários pelo admin (no escopo):** ativar/desativar usuário e resetar senha.

## Decisões-chave (validadas)

- **Publicação = tudo encerrado desde a última publicação.** Sem seleção manual jogo a jogo; na prática, os jogos do dia.
- **Publicação é global.** Um único evento atualiza o ranking de publicação e a variação de todos os bolões habilitados de uma vez.
- **Participante vê o último snapshot publicado, congelado.** Placares novos não aparecem até o admin publicar. Só o admin vê o draft ao vivo.
- **Habilitar bolão privado = gate de ativação/pagamento**, modelado via `Bolao.status = PAGO`.
- **Correção de placar pós-publicação** reflete no draft ao vivo, mas só chega ao participante na próxima publicação. O jogo mantém seu `publicacaoId` original.

## Modelo de dados (Prisma)

### Novo: `Publicacao` (evento global, sequencial)
```prisma
model Publicacao {
  id             String   @id @default(uuid())
  numero         Int      @unique          // 1, 2, 3... rodada de publicação
  publicadoEm    DateTime @default(now())
  publicadoPorId String
  publicadoPor   Usuario  @relation(fields: [publicadoPorId], references: [id])

  jogos     Jogo[]
  snapshots RankingSnapshot[]

  @@map("publicacao")
}
```

### Alterado: `Jogo.publicacaoId` (nullable)
Marca a qual publicação/rodada o jogo pertence. `null` enquanto não publicado. Ao publicar, todos os jogos com placar preenchido e `publicacaoId = null` recebem o `id`/`numero` da nova publicação. Define o conjunto de jogos de cada rodada.

```prisma
model Jogo {
  // ... campos existentes ...
  publicacaoId String?
  publicacao   Publicacao? @relation(fields: [publicacaoId], references: [id])
}
```

### Novo: `RankingSnapshot` (foto congelada que o participante vê)
```prisma
model RankingSnapshot {
  id              String     @id @default(uuid())
  publicacaoId    String
  publicacao      Publicacao @relation(fields: [publicacaoId], references: [id])
  bolaoId         String
  usuarioId       String
  posicao         Int        // posição no ranking GERAL nesta publicação
  posicoesGanhas  Int        @default(0) // posicaoAnterior - posicao (+ subiu, - caiu)
  pontuacaoTotal  Int        // acumulado até esta publicação (ranking geral)
  pontuacaoRodada Int        // pontos só dos jogos desta publicação (ranking da publicação)

  @@unique([publicacaoId, bolaoId, usuarioId])
  @@map("ranking_snapshot")
}
```

O modelo `Ranking` atual permanece como **draft ao vivo** (estado que o admin pré-visualiza). O participante lê sempre o `RankingSnapshot` da última publicação.

Sem mudança em `Bolao.status` (`PAGO` = habilitado).

### Alterado: `Usuario.ativo` (gestão pelo admin)
```prisma
model Usuario {
  // ... campos existentes ...
  ativo Boolean @default(true)
}
```
Usuário desativado é bloqueado no login (gate de autenticação).

## Fluxo de publicação (backend)

### Pré-visualização (admin, a qualquer momento)
`GET /admin/ranking/:bolaoId/draft` — guard `JWT + ADMIN`
- Recalcula o ranking geral ao vivo do bolão (reusa `recalcularRankingBolao`).
- Calcula variação **projetada**: posição no draft vs `posicao` do último `RankingSnapshot` do bolão.
- Não grava nada.

### Publicar (admin, evento global)
`POST /admin/publicacoes` — guard `JWT + ADMIN`, sem body por bolão. Transação única:
1. Cria `Publicacao` com `numero = (último numero) + 1`.
2. Seleciona todos os `Jogo` com placar preenchido e `publicacaoId = null` → seta `publicacaoId` para a nova publicação.
3. Recalcula o ranking geral ao vivo de **cada bolão habilitado** (`status = PAGO`), a partir dos seus membros.
4. Para cada bolão × usuário, grava um `RankingSnapshot`:
   - `posicao`, `pontuacaoTotal` = ranking geral recalculado.
   - `posicoesGanhas` = `posicaoAnterior − posicao` (do snapshot da publicação anterior; `0` se não houver).
   - `pontuacaoRodada` = soma das `pontuacao` das apostas do usuário nos jogos desta publicação.
5. Retorna `{ numero, publicadoEm }`.

## Rankings, variação e gráfico (participante)

Tudo lido do `RankingSnapshot` da última publicação do bolão.

### Ranking geral — `GET /boloes/:bolaoId/ranking`
- Linhas da última publicação, ordenadas por `posicao`.
- Exibe `posicoesGanhas` (↑ verde / ↓ vermelho / = cinza) e `pontuacaoTotal`.
- Sem nenhuma publicação → estado "aguardando publicação".

### Ranking da publicação (detalhado) — `GET /boloes/:bolaoId/ranking?publicacao=N`
- Default = última publicação.
- Mesmas linhas, ordenadas/exibindo `pontuacaoRodada` (pontos só da rodada).
- **Sem variação** (regra: ranking detalhado não tem variação).
- Seletor de publicação (N, N-1, ...) para navegar rodadas passadas.

### Gráfico de evolução — `GET /boloes/:bolaoId/ranking/evolucao?usuarioId=`
- Retorna `[{ numero, posicao }]` de todos os snapshots do usuário no bolão, ordenado por `numero`.
- Default = usuário logado; aceita `usuarioId` para ver outro membro.
- Frontend: eixo X = número da publicação, eixo Y = posição (invertido, 1 no topo).

## Capacidades do admin

1. **Habilitar/desabilitar bolões privados** — `PATCH /admin/boloes/:bolaoId/status`. Habilitar = `PAGO` (entra nas publicações, ranking visível); desabilitar = `ATIVO`/`ARQUIVADO` (sai das publicações; snapshots existentes permanecem).
2. **Controlar placar** — `PATCH /jogos/:jogoId/placar` (já existe). Recalcula pontuação ao vivo; participante vê na próxima publicação.
3. **Pré-visualizar ranking** — `GET /admin/ranking/:bolaoId/draft`. Draft ao vivo + variação projetada. Não publica.
4. **Publicar rankings** — `POST /admin/publicacoes`. Evento global; botão "Publicar rodada N" com confirmação (mostra quantos jogos novos entram).
5. **Gerir usuários** — `PATCH /admin/usuarios/:id` (body `{ ativo?: boolean; role?: Role }`) e `POST /admin/usuarios/:id/reset-senha` (envia e-mail de redefinição). Listagem em `GET /admin/usuarios`.

### Telas admin — route group `/(admin)/` com guard de role (USER comum redirecionado para `/jogos`)
- `/(admin)/boloes` — habilitar/desabilitar bolões privados.
- `/(admin)/placares` — entrada de placar por jogo.
- `/(admin)/ranking` — pré-visualização por bolão + botão publicar global.
- `/(admin)/usuarios` — lista com toggle de ativo/inativo, troca de role e ação de resetar senha.

## Frontend (participante)

- **`/ranking/[bolaoId]`**:
  - Toggle **Geral / Rodada**.
  - Geral: seta de variação (`posicoesGanhas`) + `pontuacaoTotal`.
  - Rodada: seletor de publicação + `pontuacaoRodada`, sem variação.
  - Estado "aguardando publicação" quando não há snapshot.
  - Reaproveita `RankingPodium` / `RankingRow`.
- **Gráfico de evolução** — novo componente `RankingEvolucao.tsx` usando **Recharts** (nova dependência do frontend). Line chart com eixo Y invertido (posição 1 no topo). Consome `/evolucao`.

## Testes

### Backend (Jest, unit)
- `PublicacaoService.publicar`: numeração sequencial; marca jogos com placar + `publicacaoId null`; gera snapshots; `pontuacaoRodada` só dos jogos da rodada; `posicoesGanhas` vs publicação anterior (`0` na primeira).
- Correção de placar pós-publicação não altera snapshot já gravado.
- Draft: variação projetada sem persistir.
- Bolão desabilitado (não-`PAGO`) não recebe snapshot.
- `evolucao`: série ordenada por `numero`.
- `AdminService.atualizarUsuario`: altera `ativo`/`role`; usuário inativo é barrado no login.
- `AdminService.resetarSenha`: dispara o fluxo de e-mail de redefinição.

### Frontend (Jest / RTL)
- Toggle geral/rodada.
- Render de variação (↑/↓/=).
- Estado "aguardando publicação".
- `RankingEvolucao` renderiza pontos a partir de mock.

## Mapa de arquivos (alto nível)

| Ação | Caminho |
|---|---|
| Modificar | `apps/backend/prisma/schema.prisma` (+ `Publicacao`, `RankingSnapshot`, `Jogo.publicacaoId`, `Usuario.ativo`) |
| Criar | `apps/backend/prisma/migrations/<ts>_publicacao_ranking/migration.sql` |
| Criar | `apps/backend/src/publicacao/` (module, service, controller, spec) |
| Modificar | `apps/backend/src/admin/admin.service.ts` + `admin.controller.ts` (draft com variação, status do bolão, gestão de usuários: ativo/role/reset-senha) |
| Modificar | `apps/backend/src/auth/*` (login barra usuário inativo) |
| Modificar | `apps/backend/src/ranking/ranking.service.ts` (leitura por snapshot, endpoint evolução) |
| Modificar | `apps/frontend/package.json` (+ recharts) |
| Modificar | `apps/frontend/src/app/(app)/ranking/[bolaoId]/page.tsx` |
| Criar | `apps/frontend/src/components/RankingEvolucao.tsx` |
| Criar | `apps/frontend/src/app/(admin)/` (boloes, placares, ranking, usuarios) |
