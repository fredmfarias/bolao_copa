-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'PAGO');

-- AlterTable
ALTER TABLE "bolao_membro" ADD COLUMN     "statusPagamento" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE';

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "telefone" TEXT NOT NULL DEFAULT '';
