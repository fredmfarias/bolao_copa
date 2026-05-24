# Backend Gaps — O que ainda não existe

> Contexto permanente. Carregar sempre que integrar com a API.
> Atualizar quando um endpoint for implementado (marcar `✅ implementado`).

---

## Endpoints existentes (referência rápida)

| Método | Path | Guard | Observação |
|---|---|---|---|
| `POST` | `/auth/registrar` | público | |
| `POST` | `/auth/login` | público | seta cookie `refresh_token` |
| `GET` | `/auth/confirmar-email` | público | `?token=` |
| `POST` | `/auth/esqueceu-senha` | público | |
| `POST` | `/auth/nova-senha` | público | |
| `POST` | `/auth/refresh` | público | lê cookie |
| `POST` | `/auth/logout` | público | limpa cookie |
| `GET` | `/auth/google` | público | inicia OAuth |
| `GET` | `/auth/google/callback` | público | cria user + entra em BOLAO_GLOBAL |
| `POST` | `/apostas` | JWT | upsert de aposta |
| `GET` | `/apostas/bolao/:bolaoId` | JWT | apostas do usuário logado no bolao |
| `POST` | `/boloes` | JWT | criar bolao |
| `GET` | `/boloes/meus` | JWT | boloes do usuário |
| `GET` | `/boloes/buscar` | JWT | `?nome=` |
| `GET` | `/boloes/:bolaoId` | JWT | detalhes |
| `POST` | `/boloes/:bolaoId/convite` | JWT + MODERADOR | cria/retorna token de convite |
| `POST` | `/boloes/entrar/:token` | JWT | entra via token no path |
| `POST` | `/boloes/:bolaoId/solicitar` | JWT | pede para entrar |
| `POST` | `/boloes/:bolaoId/aprovar/:usuarioId` | JWT + MODERADOR | |
| `POST` | `/boloes/:bolaoId/remover/:usuarioId` | JWT + MODERADOR | |
| `POST` | `/boloes/:bolaoId/eleger/:usuarioId` | JWT + MODERADOR | promove a moderador |
| `PATCH` | `/boloes/:bolaoId/status` | JWT + ADMIN | muda status do bolao |
| `GET` | `/jogos` | JWT | `?fase=` |
| `GET` | `/jogos/:jogoId` | JWT | |
| `POST` | `/jogos` | JWT + ADMIN | criar jogo |
| `PATCH` | `/jogos/:jogoId/placar` | JWT + ADMIN | entrar placar |
| `GET` | `/boloes/:bolaoId/ranking` | JWT | retorna ranking (apenas bolões com status PAGO) |
| `GET` | `/usuarios/me` | JWT | |
| `PATCH` | `/usuarios/me` | JWT | atualizar perfil |
| `GET` | `/notificacoes/vapid-public-key` | público | |
| `POST` | `/notificacoes/subscribe` | JWT | |
| `DELETE` | `/notificacoes/subscribe` | JWT | |

---

## Gaps por módulo

### M3 — Ranking / Palpites

**`GET /boloes/:bolaoId/apostas?jogoId=`**

- Guard: JWT
- Response: `{ usuarioId, nome, avatarUrl, placarCasa, placarVisitante, pontuacao }[]`
- Usado em: tela `/palpites/[jogoId]` — mostra palpites de todos os membros do bolão para um jogo específico
- Observação: o endpoint atual `/apostas/bolao/:bolaoId` retorna apostas do usuário logado. Este novo endpoint retorna de todos os membros, filtrado por jogo.

**Schema — adicionar campo `posicoesGanhas` em `Ranking`:**

```prisma
model Ranking {
  // ... campos existentes ...
  posicoesGanhas Int @default(0)   // variação vs snapshot anterior publicado
}
```

---

### M4 — Admin

**`GET /admin/ranking/:bolaoId/draft`**

- Guard: JWT + ADMIN
- Response: mesmo shape de `GET /boloes/:bolaoId/ranking` + `posicoesGanhas` calculado
- Usado em: `AdminRankingPreview` — admin visualiza antes de publicar
- Observação: o endpoint atual filtra por `status === PAGO`. O draft precisa retornar dados independente do status.

**`POST /admin/ranking/:bolaoId/publicar`**

- Guard: JWT + ADMIN
- Body: `{}` (sem body)
- Ação: calcula `posicoesGanhas` relativo ao snapshot anterior → salva no DB → registra `rankingPublicadoEm` no Bolao → marca ranking como publicado
- Response: `{ publicadoEm: string }`

**`PATCH /admin/usuarios/:id`**

- Guard: JWT + ADMIN
- Body: `{ ativo?: boolean; role?: Role }`
- Response: `{ id, nome, email, role, ativo }`

**`POST /admin/usuarios/:id/reset-senha`**

- Guard: JWT + ADMIN
- Body: `{}`
- Ação: envia e-mail de reset de senha para o usuário

**Schema — adicionar campos em `Bolao`:**

```prisma
model Bolao {
  // ... campos existentes ...
  rankingPublicadoEm DateTime?
}
```

```prisma
model Usuario {
  // ... campos existentes ...
  ativo Boolean @default(true)
}
```

---

### M5 — Bolão / Convite

**`GET /convites/:codigo`** (público, sem auth)

- Guard: público
- Response: `{ bolaoId, bolaoNome, descricao, criadorNome, expiraEm, valido: boolean }`
- Usado em: landing `/convite/[codigo]` — exibida antes do usuário fazer login
- Observação: o endpoint atual `POST /boloes/:bolaoId/convite` requer autenticação de moderador. Este é um endpoint de leitura pública via código de convite.
- Diferença de URL: o token atual fica em `BolaoConvite.token` (UUID). O `codigo` aqui é esse mesmo token — apenas renomear para clareza de UX.

---

## Gaps de schema (Prisma)

| Modelo | Campo | Tipo | Motivo |
|---|---|---|---|
| `Ranking` | `posicoesGanhas` | `Int @default(0)` | variação de posição vs publicação anterior (M3/M4) |
| `Bolao` | `rankingPublicadoEm` | `DateTime?` | data/hora da última publicação de ranking (M4) |
| `Usuario` | `ativo` | `Boolean @default(true)` | toggle de usuário pelo admin (M4) |

---

## Resumo operacional

A maioria dos endpoints de negócio já existe. Os 6 gaps reais estão concentrados em: (1) leitura de palpites de todos os membros por jogo — M3; (2) draft/publicação do ranking — M4; (3) gestão de usuários pelo admin — M4; (4) lookup público de convite — M5. Três campos de schema também precisam ser adicionados via migration.
