-- AlterTable
ALTER TABLE "ranking" ADD COLUMN "pontosMaximoPossiveis" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ranking_snapshot" ADD COLUMN "pontosMaximoPossiveis"       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ranking_snapshot" ADD COLUMN "pontosMaximoPossiveisRodada" INTEGER NOT NULL DEFAULT 0;
