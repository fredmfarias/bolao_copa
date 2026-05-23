-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "BolaoStatus" AS ENUM ('ATIVO', 'PAGO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "BolaoEscopo" AS ENUM ('GRUPOS', 'ELIMINATORIAS', 'AMBOS');

-- CreateEnum
CREATE TYPE "JogoFase" AS ENUM ('GRUPOS', 'OITAVAS', 'QUARTAS', 'SEMIS', 'TERCEIRO_LUGAR', 'FINAL');

-- CreateEnum
CREATE TYPE "BolaoMembroPapel" AS ENUM ('MODERADOR', 'PARTICIPANTE');

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT,
    "googleId" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "avatarUrl" TEXT,
    "emailVerificado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bolao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "BolaoStatus" NOT NULL DEFAULT 'ATIVO',
    "escopo" "BolaoEscopo" NOT NULL,
    "maxParticipantes" INTEGER NOT NULL,
    "precoReais" DECIMAL(10,2) NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bolao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bolao_membro" (
    "id" TEXT NOT NULL,
    "bolaoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "papel" "BolaoMembroPapel" NOT NULL DEFAULT 'PARTICIPANTE',
    "entrouEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bolao_membro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bolao_convite" (
    "id" TEXT NOT NULL,
    "bolaoId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3),

    CONSTRAINT "bolao_convite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "selecao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "bandeiraSvg" TEXT NOT NULL,
    "grupo" CHAR(1) NOT NULL,

    CONSTRAINT "selecao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estadio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "pais" TEXT NOT NULL,

    CONSTRAINT "estadio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jogo" (
    "id" TEXT NOT NULL,
    "selecaoCasaId" TEXT NOT NULL,
    "selecaoVisitanteId" TEXT NOT NULL,
    "estadioId" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "rodada" INTEGER NOT NULL,
    "grupo" CHAR(1),
    "fase" "JogoFase" NOT NULL,
    "placarCasa" INTEGER,
    "placarVisitante" INTEGER,
    "pesoPontuacao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "jogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aposta" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "jogoId" TEXT NOT NULL,
    "bolaoId" TEXT NOT NULL,
    "placarCasa" INTEGER NOT NULL,
    "placarVisitante" INTEGER NOT NULL,
    "pontuacao" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aposta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking" (
    "id" TEXT NOT NULL,
    "bolaoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "pontuacaoTotal" INTEGER NOT NULL DEFAULT 0,
    "acertosPlacarExato" INTEGER NOT NULL DEFAULT 0,
    "acertosPlacarVencedor" INTEGER NOT NULL DEFAULT 0,
    "acertosPlacarPerdedor" INTEGER NOT NULL DEFAULT 0,
    "acertosEmpate" INTEGER NOT NULL DEFAULT 0,
    "acertosGanhador" INTEGER NOT NULL DEFAULT 0,
    "acertosNada" INTEGER NOT NULL DEFAULT 0,
    "posicao" INTEGER NOT NULL DEFAULT 0,
    "apostasPostadas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ranking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracao_pontuacao" (
    "id" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "pontos" INTEGER NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "atualizadoPorId" TEXT,

    CONSTRAINT "configuracao_pontuacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacao_subscription" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacao_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_googleId_key" ON "usuario"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "bolao_membro_bolaoId_usuarioId_key" ON "bolao_membro"("bolaoId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "bolao_convite_token_key" ON "bolao_convite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "selecao_codigo_key" ON "selecao"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "estadio_nome_key" ON "estadio"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "aposta_usuarioId_jogoId_bolaoId_key" ON "aposta"("usuarioId", "jogoId", "bolaoId");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_bolaoId_usuarioId_key" ON "ranking"("bolaoId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "configuracao_pontuacao_nivel_key" ON "configuracao_pontuacao"("nivel");

-- CreateIndex
CREATE UNIQUE INDEX "notificacao_subscription_endpoint_key" ON "notificacao_subscription"("endpoint");

-- AddForeignKey
ALTER TABLE "bolao" ADD CONSTRAINT "bolao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bolao_membro" ADD CONSTRAINT "bolao_membro_bolaoId_fkey" FOREIGN KEY ("bolaoId") REFERENCES "bolao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bolao_membro" ADD CONSTRAINT "bolao_membro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bolao_convite" ADD CONSTRAINT "bolao_convite_bolaoId_fkey" FOREIGN KEY ("bolaoId") REFERENCES "bolao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bolao_convite" ADD CONSTRAINT "bolao_convite_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jogo" ADD CONSTRAINT "jogo_selecaoCasaId_fkey" FOREIGN KEY ("selecaoCasaId") REFERENCES "selecao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jogo" ADD CONSTRAINT "jogo_selecaoVisitanteId_fkey" FOREIGN KEY ("selecaoVisitanteId") REFERENCES "selecao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jogo" ADD CONSTRAINT "jogo_estadioId_fkey" FOREIGN KEY ("estadioId") REFERENCES "estadio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aposta" ADD CONSTRAINT "aposta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aposta" ADD CONSTRAINT "aposta_jogoId_fkey" FOREIGN KEY ("jogoId") REFERENCES "jogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aposta" ADD CONSTRAINT "aposta_bolaoId_fkey" FOREIGN KEY ("bolaoId") REFERENCES "bolao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking" ADD CONSTRAINT "ranking_bolaoId_fkey" FOREIGN KEY ("bolaoId") REFERENCES "bolao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking" ADD CONSTRAINT "ranking_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracao_pontuacao" ADD CONSTRAINT "configuracao_pontuacao_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacao_subscription" ADD CONSTRAINT "notificacao_subscription_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
