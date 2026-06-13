-- AlterTable
ALTER TABLE "aposta" ADD COLUMN     "palpiteAtualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: horário do palpite herda o atualizadoEm atual das apostas existentes.
UPDATE "aposta" SET "palpiteAtualizadoEm" = "atualizadoEm";
