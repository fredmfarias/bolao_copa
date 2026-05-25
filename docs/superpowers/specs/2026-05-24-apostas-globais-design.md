# Spec: Apostas Globais — Uma Aposta por Jogo por Usuário

**Data:** 2026-05-24
**Status:** Aprovado

---

## Contexto

Hoje uma aposta está atrelada a um bolão (`bolaoId`). Um usuário que participa de N bolões precisa registrar N apostas para o mesmo jogo — uma por bolão. Isso cria fricção desnecessária e duplicação de dados.

A mudança: apostas se tornam globais. Um usuário faz **uma única aposta por jogo** e ela vale para todos os bolões em que participa. Todo controle de apostas fica exclusivamente na página Jogos. Os palpites de outros membros continuam organizados por contexto de bolão.

---

## Escopo

### O que muda

1. **Schema:** `bolaoId` removido do modelo `Aposta`
2. **Backend — Aposta Service:** `upsert` e `listar` sem bolaoId; limite de apostas idênticas passa a ser global
3. **Backend — Palpites endpoint:** checa prazo antes de retornar palpites de outros usuários
4. **Backend — Ranking Service:** join via `BolaoMembro` para encontrar apostas dos membros
5. **Frontend — Jogos page / ApostaDrawer:** remove referências a bolaoId
6. **Frontend — Palpites:** nova rota `/boloes/[bolaoId]/palpites/[jogoId]`, seletor de bolão
7. **Migração:** deduplicação de apostas existentes antes de remover a coluna

### O que não muda

- Regras de prazo: 60 minutos antes do kickoff
- Limites de apostas idênticas: 18 na fase de grupos, 8 nas eliminatórias
- Cálculo de pontuação por nível (1–5)
- Ranking por bolão
- `BOLAO_GLOBAL_ID` continua existindo como bolão

---

## Alteração 1 — Schema (Prisma)

**Arquivo:** `apps/backend/prisma/schema.prisma`

Remover do modelo `Aposta`:
- Campo `bolaoId String`
- Relação `bolao Bolao @relation(...)`
- Constraint `@@unique([usuarioId, jogoId, bolaoId])`

Adicionar:
- Constraint `@@unique([usuarioId, jogoId])`

Remover do modelo `Bolao`:
- Relação `apostas Aposta[]`

Resultado:

```prisma
model Aposta {
  id              String   @id @default(uuid())
  usuarioId       String
  usuario         Usuario  @relation(fields: [usuarioId], references: [id])
  jogoId          String
  jogo            Jogo     @relation(fields: [jogoId], references: [id])
  placarCasa      Int
  placarVisitante Int
  pontuacao       Int?
  criadoEm       DateTime @default(now())
  atualizadoEm   DateTime @updatedAt

  @@unique([usuarioId, jogoId])
  @@map("aposta")
}
```

---

## Alteração 2 — Migração de Dados

Antes de remover a coluna `bolaoId`, uma migration SQL consolida apostas duplicadas:

```sql
-- Para cada (usuarioId, jogoId) com múltiplos registros,
-- manter apenas o do BOLAO_GLOBAL_ID se existir,
-- senão manter o mais recente (maior atualizadoEm).
-- Apagar os demais.
DELETE FROM aposta
WHERE id NOT IN (
  SELECT DISTINCT ON (usuarioid, jogoid) id
  FROM aposta
  ORDER BY
    usuarioid,
    jogoid,
    CASE WHEN bolaoid = '00000000-0000-0000-0000-000000000001' THEN 0 ELSE 1 END,
    "atualizadoEm" DESC
);

ALTER TABLE aposta DROP COLUMN bolaoid;
```

A migration Prisma é gerada via `prisma migrate dev`.

---

## Alteração 3 — Backend: Aposta Service

**Arquivo:** `apps/backend/src/aposta/aposta.service.ts`

### 3.1 `upsert(usuarioId, dto)`

DTO perde `bolaoId`. Remoções:
- Validação de membership no bolão (check `BolaoMembro` removido)
- Referência a `bolaoId` no upsert do Prisma
- Referência a `bolaoId` no count de apostas idênticas

O limite de apostas idênticas passa a ser **global por usuário** (não por bolão):

```typescript
const totalIguais = await this.prisma.aposta.count({
  where: {
    usuarioId,
    placarCasa: dto.placarCasa,
    placarVisitante: dto.placarVisitante,
    jogo: { fase: isElim ? { in: FASES_ELIMINATORIAS } : { equals: 'GRUPOS' } },
  },
});
```

O upsert usa a nova constraint:

```typescript
return this.prisma.aposta.upsert({
  where: { usuarioId_jogoId: { usuarioId, jogoId: dto.jogoId } },
  update: { placarCasa: dto.placarCasa, placarVisitante: dto.placarVisitante, pontuacao: null },
  create: { usuarioId, jogoId: dto.jogoId, placarCasa: dto.placarCasa, placarVisitante: dto.placarVisitante },
});
```

### 3.2 `listar(usuarioId)`

Substitui `listarPorBolao(bolaoId, usuarioId)`. Retorna todas as apostas do usuário sem filtro de bolão:

```typescript
async listar(usuarioId: string) {
  return this.prisma.aposta.findMany({
    where: { usuarioId },
    include: { jogo: { include: { selecaoCasa: true, selecaoVisitante: true } } },
    orderBy: { jogo: { dataHora: 'asc' } },
  });
}
```

### 3.3 `listarPalpitesPorJogo(bolaoId, jogoId)`

Reescrito com duas responsabilidades: verificar prazo e filtrar por membros do bolão.

```typescript
async listarPalpitesPorJogo(bolaoId: string, jogoId: string) {
  // 1. Verificar prazo — palpites só visíveis após encerramento das apostas
  const jogo = await this.prisma.jogo.findUnique({ where: { id: jogoId } });
  if (!jogo) throw new NotFoundException('Jogo não encontrado.');

  const prazo = new Date(jogo.dataHora.getTime() - MINUTOS_PRAZO_APOSTA * 60 * 1000);
  if (new Date() < prazo) {
    throw new ForbiddenException('Palpites disponíveis apenas após o encerramento das apostas.');
  }

  // 2. Buscar membros do bolão
  const membros = await this.prisma.bolaoMembro.findMany({
    where: { bolaoId },
    select: { usuarioId: true },
  });
  const usuarioIds = membros.map(m => m.usuarioId);

  // 3. Buscar apostas globais desses membros para o jogo
  const apostas = await this.prisma.aposta.findMany({
    where: { jogoId, usuarioId: { in: usuarioIds } },
    include: { usuario: { select: { id: true, nome: true, avatarUrl: true } } },
    orderBy: [{ pontuacao: 'desc' }, { usuario: { nome: 'asc' } }],
  });

  return apostas.map(a => ({
    usuarioId: a.usuarioId,
    nome: a.usuario.nome,
    avatarUrl: a.usuario.avatarUrl,
    placarCasa: a.placarCasa,
    placarVisitante: a.placarVisitante,
    pontuacao: a.pontuacao,
  }));
}
```

**Regra de segurança:** O prazo é verificado no backend. Chamadas diretas à API antes do encerramento retornam `403 Forbidden`, independentemente do frontend.

---

## Alteração 4 — Backend: Aposta DTO

**Arquivo:** `apps/backend/src/aposta/dto/upsert-aposta.dto.ts`

Remove `bolaoId`:

```typescript
export class UpsertApostaDto {
  @IsString() jogoId: string;
  @IsInt() @Min(0) placarCasa: number;
  @IsInt() @Min(0) placarVisitante: number;
}
```

---

## Alteração 5 — Backend: Aposta Controller

**Arquivo:** `apps/backend/src/aposta/aposta.controller.ts`

- `POST /apostas` — sem `bolaoId` no body
- `GET /apostas` — substitui `GET /apostas/bolao/:bolaoId`, chama `listar(usuarioId)`

```typescript
@Get()
listar(@CurrentUser() user: { id: string }) {
  return this.aposta.listar(user.id);
}
```

---

## Alteração 6 — Backend: Ranking Service

**Arquivo:** `apps/backend/src/ranking/ranking.service.ts`

### `recalcularRankingBolao(bolaoId)`

Em vez de filtrar apostas por `bolaoId`, busca os membros do bolão e então suas apostas globais:

```typescript
// Antes:
const apostas = await this.prisma.aposta.findMany({
  where: { bolaoId, pontuacao: { not: null } },
  include: { jogo: true },
});

// Depois:
const membros = await this.prisma.bolaoMembro.findMany({
  where: { bolaoId },
  select: { usuarioId: true },
});
const usuarioIds = membros.map(m => m.usuarioId);

const apostas = await this.prisma.aposta.findMany({
  where: { usuarioId: { in: usuarioIds }, pontuacao: { not: null } },
  include: { jogo: true },
});
```

O restante da lógica de cálculo e upsert do ranking permanece igual.

### `recalcularParaJogo(jogoId)`

Remove a linha que agrupa bolaoIds das apostas:

```typescript
// Antes:
const bolaoIds = [...new Set(apostas.map((a) => a.bolaoId))];

// Depois: recalcular ranking de todos os bolões que têm membros com aposta nesse jogo
const usuarioIds = apostas.map(a => a.usuarioId);
const membros = await this.prisma.bolaoMembro.findMany({
  where: { usuarioId: { in: usuarioIds } },
  select: { bolaoId: true },
});
const bolaoIds = [...new Set(membros.map(m => m.bolaoId))];
```

---

## Alteração 7 — Frontend: Jogos page & ApostaDrawer

**Arquivo:** `apps/frontend/src/app/(app)/jogos/page.tsx`

- `GET /apostas/bolao/${BOLAO_GLOBAL_ID}` → `GET /apostas`
- `ApostaDrawer` perde a prop `bolaoId`

**Arquivo:** `apps/frontend/src/components/ApostaDrawer.tsx`

- Remove `bolaoId` das props e do body do `POST /apostas`

---

## Alteração 8 — Frontend: Palpites (nova rota e UX)

### Nova rota

```
/boloes/[bolaoId]/palpites/[jogoId]
```

**Arquivo:** `apps/frontend/src/app/(app)/boloes/[id]/palpites/[jogoId]/page.tsx`

A página atual `/palpites/[jogoId]/page.tsx` é removida.

### Comportamento

**Antes do prazo** (mais de 60 min para o kickoff):
- Exibe mensagem: "Os palpites serão revelados quando as apostas encerrarem."
- Nenhum palpite visível (o backend também nega com 403)

**Após o prazo:**
- Exibe a lista de palpites dos membros do bolão selecionado

### Seletor de bolão

O usuário busca seus bolões via `GET /boloes` (endpoint já existente). Com base no resultado:

- **1 bolão privado:** pré-selecionado, sem dropdown visível
- **Múltiplos bolões privados:** dropdown com lista de bolões + opção "Global"
- **Apenas bolão global:** bolão global pré-selecionado

Trocar o bolão no seletor navega para `/boloes/[novoBolaoId]/palpites/[jogoId]`.

### Ponto de entrada na página do bolão

**Arquivo:** `apps/frontend/src/app/(app)/boloes/[id]/page.tsx`

Para jogos com prazo de apostas encerrado (verificação local em `jogo.dataHora`), exibir botão/link "Ver palpites" que navega para `/boloes/[id]/palpites/[jogoId]`.

---

## Fluxo completo pós-implementação

```
1. Usuário abre a página Jogos
2. Clica em um jogo → ApostaDrawer abre (sem bolaoId)
3. Registra aposta → POST /apostas (jogoId + placar)
4. Aposta vale para todos os bolões em que participa

5. Quando faltam < 60min para o kickoff, apostas encerram
6. Usuário acessa a página do bolão (/boloes/[id])
7. Clica em "Ver palpites" em um jogo com prazo encerrado
8. Navega para /boloes/[id]/palpites/[jogoId]
9. Vê palpites de todos os membros daquele bolão
10. Pode navegar para outros bolões via seletor
```

---

## Casos de erro

| Situação | Comportamento |
|---|---|
| Chamar GET palpites antes do prazo | Backend retorna `403 Forbidden` |
| Jogo não encontrado em GET palpites | Backend retorna `404 Not Found` |
| Usuário sem bolões privados | Seletor pré-seleciona o bolão global |
| Usuário aposta após prazo | Backend retorna `403 Forbidden` (regra já existente) |
| Limite de apostas idênticas atingido | Backend retorna `400 Bad Request` |

---

## Alteração de constante

**Arquivo:** `packages/shared/src/enums.ts`

Atualizar `MAX_APOSTAS_IGUAIS_GRUPOS` de `25` para `18`:

```typescript
export const MAX_APOSTAS_IGUAIS_GRUPOS = 18;
```

---

## Fora do escopo

- Reprocessamento histórico de pontuações
- Mudanças no sistema de pontuação ou nos pesos por jogo
- Push notifications de palpites revelados
- Qualquer mudança na página de Ranking
