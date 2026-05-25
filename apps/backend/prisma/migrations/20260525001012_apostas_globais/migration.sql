-- Deduplicate apostas: para cada (usuarioId, jogoId) manter apenas um registro.
-- Prioridade: aposta do bolão global (00000000-0000-0000-0000-000000000001),
-- senão a mais recente por atualizadoEm.
DELETE FROM aposta
WHERE id NOT IN (
  SELECT DISTINCT ON ("usuarioId", "jogoId") id
  FROM aposta
  ORDER BY
    "usuarioId",
    "jogoId",
    CASE WHEN "bolaoId" = '00000000-0000-0000-0000-000000000001' THEN 0 ELSE 1 END,
    "atualizadoEm" DESC
);

-- DropForeignKey
ALTER TABLE "aposta" DROP CONSTRAINT "aposta_bolaoId_fkey";

-- DropIndex
DROP INDEX "aposta_usuarioId_jogoId_bolaoId_key";

-- AlterTable
ALTER TABLE "aposta" DROP COLUMN "bolaoId";

-- CreateIndex
CREATE UNIQUE INDEX "aposta_usuarioId_jogoId_key" ON "aposta"("usuarioId", "jogoId");
