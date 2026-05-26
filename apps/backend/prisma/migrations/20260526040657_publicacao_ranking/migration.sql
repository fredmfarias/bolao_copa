-- AlterTable
ALTER TABLE "jogo" ADD COLUMN     "publicacaoId" TEXT;

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "publicacao" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "publicadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicadoPorId" TEXT NOT NULL,

    CONSTRAINT "publicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_snapshot" (
    "id" TEXT NOT NULL,
    "publicacaoId" TEXT NOT NULL,
    "bolaoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "posicao" INTEGER NOT NULL,
    "posicoesGanhas" INTEGER NOT NULL DEFAULT 0,
    "pontuacaoTotal" INTEGER NOT NULL DEFAULT 0,
    "pontuacaoRodada" INTEGER NOT NULL DEFAULT 0,
    "acertosPlacarExato" INTEGER NOT NULL DEFAULT 0,
    "acertosPlacarVencedor" INTEGER NOT NULL DEFAULT 0,
    "acertosPlacarPerdedor" INTEGER NOT NULL DEFAULT 0,
    "acertosEmpate" INTEGER NOT NULL DEFAULT 0,
    "acertosGanhador" INTEGER NOT NULL DEFAULT 0,
    "acertosNada" INTEGER NOT NULL DEFAULT 0,
    "apostasPostadas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ranking_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "publicacao_numero_key" ON "publicacao"("numero");

-- CreateIndex
CREATE INDEX "ranking_snapshot_bolaoId_usuarioId_idx" ON "ranking_snapshot"("bolaoId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_snapshot_publicacaoId_bolaoId_usuarioId_key" ON "ranking_snapshot"("publicacaoId", "bolaoId", "usuarioId");

-- AddForeignKey
ALTER TABLE "jogo" ADD CONSTRAINT "jogo_publicacaoId_fkey" FOREIGN KEY ("publicacaoId") REFERENCES "publicacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_publicadoPorId_fkey" FOREIGN KEY ("publicadoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_snapshot" ADD CONSTRAINT "ranking_snapshot_publicacaoId_fkey" FOREIGN KEY ("publicacaoId") REFERENCES "publicacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_snapshot" ADD CONSTRAINT "ranking_snapshot_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
