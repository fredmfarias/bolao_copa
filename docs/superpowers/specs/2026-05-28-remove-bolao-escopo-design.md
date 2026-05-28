# Design: Remoção de BolaoEscopo e Consolidação de Migrations

**Data:** 2026-05-28

## Contexto

O campo `escopo` do bolão (`GRUPOS`, `ELIMINATORIAS`, `AMBOS`) foi criado para segmentar bolões por fase da competição. Na prática, todos os bolões usam `AMBOS` (é o default no form e nas factories). O único lugar com lógica real é `notificacao.service.ts`, que filtra quais bolões recebem push notifications por fase do jogo. Essa segmentação não agrega valor e adiciona complexidade desnecessária ao modelo e à UI.

Aproveitando que o banco pode ser resetado, também consolidamos o histórico de 5 migrations incrementais em uma única migration `init` limpa que reflete o schema atual.

## Decisões

- Remover `BolaoEscopo` completamente: enum, coluna, DTO, select, form e filtro de notificação.
- `FASES_ELIMINATORIAS`, `MAX_APOSTAS_IGUAIS_*` em `@bolao/shared` **permanecem** — controlam limites de apostas duplicadas por fase do jogo, lógica independente de escopo.
- Todos os bolões ativos recebem push notifications para todos os jogos (grupos + eliminatórias).
- Migrations consolidadas em um único `init`.

## Mudanças por Arquivo

### `packages/shared/src/enums.ts`
Remove o enum `BolaoEscopo` inteiro. Mantém `FASES_ELIMINATORIAS` e demais constantes.

### `apps/backend/prisma/schema.prisma`
- Remove `enum BolaoEscopo`
- Remove coluna `escopo` do `model Bolao`

### Migrations
- Deletar os 5 diretórios existentes em `prisma/migrations/`
- Criar `prisma/migrations/20260528000000_init/migration.sql` com o schema completo e limpo
- Executar `prisma migrate reset --force` para aplicar e rodar o seed

### `apps/backend/src/bolao/dto/create-bolao.dto.ts`
Remove o campo `escopo` e o import de `BolaoEscopo`.

### `apps/backend/src/bolao/bolao.service.ts`
Remove `escopo` do `select` em `buscarPorNome`.

### `apps/backend/src/bolao/bolao.service.spec.ts`
Remove `escopo: BolaoEscopo.AMBOS` de todos os calls a `service.criar(...)`.

### `apps/backend/src/notificacao/notificacao.service.ts`
Simplifica o filtro de bolões para apenas `status: 'ATIVO'`, removendo o filtro por escopo.

### `e2e/data/factories.ts`
Remove `escopo: 'AMBOS'` do `newBolao()`.

### `apps/frontend/src/types/api.ts`
Remove `escopo` das interfaces `Bolao` e `AdminBolao`.

### `apps/frontend/src/app/admin/boloes/page.tsx`
- Remove import de `BolaoEscopo`
- Remove campo `escopo` do estado `form`
- Remove o `<select>` de escopo do formulário
- Remove `escopo: BolaoEscopo.AMBOS` dos resets de form

## Fora de Escopo

- Lógica de limites de apostas (`MAX_APOSTAS_IGUAIS_*`, `FASES_ELIMINATORIAS`) — não relacionada ao escopo do bolão.
- Qualquer outra limpeza de schema não relacionada ao `escopo`.
