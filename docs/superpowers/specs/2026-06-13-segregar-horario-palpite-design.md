# Segregar horário do palpite de atualização genérica

**Data:** 2026-06-13
**Branch:** `feat/segregar-horario-palpite`

## Problema

O campo `atualizadoEm` da tabela `aposta` usa `@updatedAt`, então é bumpado em
**qualquer** update da linha. Isso acontece em dois fluxos distintos:

1. **Salvamento do palpite** — `ApostaService.upsert` (`aposta.service.ts`).
2. **Recálculo de pontuação** — `RankingService.recalcularParaJogo`
   (`ranking.service.ts:46`), que faz `aposta.update({ data: { pontuacao } })`.

O frontend usa `atualizadoEm` como **"horário do palpite"** (`JogoCard.tsx:100`,
`PalpiteRow.tsx:57`). Após um recálculo de pontuação, esse horário passa a
refletir o momento do recálculo — informação errada para o usuário.

## Objetivo

Separar o horário do palpite da atualização genérica da linha:

- `atualizadoEm` permanece como `@updatedAt` (atualização genérica de qualquer
  natureza, incluindo recálculo de pontuação).
- Novo campo `palpiteAtualizadoEm` registra exclusivamente o horário do último
  salvamento do palpite pelo usuário.
- O frontend passa a exibir `palpiteAtualizadoEm`.

## Decisões

- **Quando atualizar `palpiteAtualizadoEm`:** em **todo salvamento** do palpite
  (`upsert`), tanto na criação quanto na atualização, independentemente de o
  placar ter mudado.
- **Nome do campo:** `palpiteAtualizadoEm`.
- **Backfill das linhas existentes:** copiar de `atualizadoEm`.
- **Payload da API (opção A):** a API expõe **apenas** `palpiteAtualizadoEm` no
  lugar de `atualizadoEm`. O `atualizadoEm` genérico não é consumido pelo front,
  então é removido das respostas.

`palpiteAtualizadoEm` **não** usa `@updatedAt` (isso o bumparia em todo update,
reintroduzindo o problema). É setado explicitamente no service.

## Mudanças

### 1. Schema — `apps/backend/prisma/schema.prisma`

No model `Aposta`:

- Mantém: `atualizadoEm DateTime @updatedAt`
- Adiciona: `palpiteAtualizadoEm DateTime @default(now())`

### 2. Migração Prisma

Nova migração que:

1. Adiciona a coluna:
   `"palpiteAtualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
2. Backfill: `UPDATE "aposta" SET "palpiteAtualizadoEm" = "atualizadoEm";`

### 3. Backend — `apps/backend/src/aposta/aposta.service.ts`

No `upsert`, setar `palpiteAtualizadoEm: new Date()` explicitamente nos dois
ramos:

- `create`: `{ ..., palpiteAtualizadoEm: new Date() }`
- `update`: `{ placarCasa, placarVisitante, pontuacao: null, palpiteAtualizadoEm: new Date() }`

`RankingService.recalcularParaJogo` (`ranking.service.ts:46`) **não é alterado** —
o update de pontuação não toca `palpiteAtualizadoEm`.

Em `listarPalpitesPorJogo` (mapper explícito), o retorno passa a expor
`palpiteAtualizadoEm` no lugar de `atualizadoEm`.

**Nota sobre a opção A:** `ApostaService.listar` retorna a entidade Prisma crua
(todos os campos da linha, incluindo `atualizadoEm`). A opção A é aplicada de
forma pragmática: o tipo `Aposta` do frontend deixa de declarar `atualizadoEm`
(passa a declarar `palpiteAtualizadoEm`), e o mapper explícito de
`listarPalpitesPorJogo` deixa de incluir `atualizadoEm`. Não será adicionado
`select`/omit no `listar` apenas para remover o campo do JSON cru.

### 4. Frontend

- `apps/frontend/src/types/api.ts`: substituir `atualizadoEm: string` por
  `palpiteAtualizadoEm: string` nas interfaces `Aposta` e `Palpite`.
- `apps/frontend/src/components/JogoCard.tsx:100`: usar `aposta.palpiteAtualizadoEm`.
- `apps/frontend/src/components/PalpiteRow.tsx:57`: usar `p.palpiteAtualizadoEm`.
- Atualizar mocks dos testes que constroem `Aposta`/`Palpite`:
  `JogoCard.test.tsx`, `jogoEstado.test.ts`, `palpites.test.ts`,
  `PlacarFiltro.test.tsx`, `PalpiteRow.test.tsx`, `PlacaresDist.test.tsx`.

## Testes

- **Backend:** teste em `aposta.service.spec.ts` confirmando que o `upsert`
  popula `palpiteAtualizadoEm`. Garantir (via spec do ranking, se aplicável) que
  o recálculo de pontuação não inclui `palpiteAtualizadoEm` no `data`.
- **Frontend:** ajustar mocks; os componentes devem renderizar o horário a
  partir de `palpiteAtualizadoEm`.

## Fora de escopo

- Nenhuma alteração no fluxo/lógica de recálculo de pontuação além de não tocar
  o novo campo.
- Nenhuma exibição do `atualizadoEm` genérico no frontend.
