# Design: Simplificação do Status do Bolão

**Data:** 2026-05-28

## Contexto

O enum `BolaoStatus` hoje tem três valores: `ATIVO`, `PAGO` e `ARQUIVADO`. A semântica é confusa: bolões nascem `ATIVO` mas só entram no ranking quando estão `PAGO`. A busca em `/boloes` filtra por `ATIVO`, o que significa que bolões "habilitados" (`PAGO`) não aparecem na busca pública. O modelo mental está invertido.

## Objetivo

Simplificar para dois estados claros:
- `ATIVO` — estado padrão ao criar; aparece na busca; entra no ranking.
- `INATIVO` — desativado pelo admin; não aparece na busca; não entra no ranking.

## Regras de Negócio

1. Bolão nasce `ATIVO`.
2. Apenas bolões `ATIVO` aparecem na busca (`GET /boloes/buscar`).
3. Apenas bolões `ATIVO` são incluídos no ranking ao publicar (`POST /admin/publicar`).
4. O admin pode alternar o status de qualquer bolão entre `ATIVO` e `INATIVO` via `PATCH /boloes/:id/status`.

## Abordagem Escolhida

Migration Prisma limpa: dropar o enum antigo e recriar com `ATIVO`/`INATIVO`. O banco pode ser resetado; todos os registros existentes ficam `ATIVO`.

## Mudanças por Arquivo

### `packages/shared/src/enums.ts`
Remove `PAGO` e `ARQUIVADO`. Adiciona `INATIVO`:
```ts
export enum BolaoStatus {
  ATIVO = 'ATIVO',
  INATIVO = 'INATIVO',
}
```

### `apps/backend/prisma/schema.prisma`
```prisma
enum BolaoStatus {
  ATIVO
  INATIVO
}
// model Bolao mantém: status BolaoStatus @default(ATIVO)
```
Gerar migration via `prisma migrate dev --name simplify-bolao-status`.

### `apps/backend/prisma/seed.ts`
Bolão Global: `BolaoStatus.PAGO` → `BolaoStatus.ATIVO`.

### `apps/backend/src/publicacao/publicacao.service.ts`
Filtro de ranking: `status: 'PAGO'` → `status: 'ATIVO'`.

### `apps/backend/src/bolao/bolao.service.ts`
`buscarPorNome` já filtra por `BolaoStatus.ATIVO` — sem mudança de lógica.

### `apps/backend/src/bolao/dto/update-bolao-status.dto.ts`
`@IsEnum(BolaoStatus)` continua válido; agora só aceita `ATIVO`/`INATIVO`.

### `apps/frontend/src/types/api.ts`
Tipos `Bolao` e `AdminBolao`: `'ATIVO' | 'PAGO' | 'ARQUIVADO'` → `'ATIVO' | 'INATIVO'`.

### `apps/frontend/src/app/admin/boloes/page.tsx`
Função `alternar`:
```ts
const novo = b.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
```
Label do botão: `'Ativo'` / `'Inativo'` (era `'Habilitado'` / `'Habilitar'`).

### Specs (`admin.service.spec.ts`, `ranking.service.spec.ts`)
Substituir qualquer ocorrência de `BolaoStatus.PAGO` por `BolaoStatus.ATIVO`.

## Fora de Escopo

- Lógica de apostas e convites não é afetada pelo status.
- Testes e2e não referenciam `PAGO`/`ARQUIVADO`, sem mudanças necessárias.
