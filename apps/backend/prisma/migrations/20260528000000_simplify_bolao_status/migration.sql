-- AlterEnum: replace PAGO/ARQUIVADO with INATIVO
BEGIN;
CREATE TYPE "BolaoStatus_new" AS ENUM ('ATIVO', 'INATIVO');
ALTER TABLE "bolao" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "bolao" ALTER COLUMN "status" TYPE "BolaoStatus_new" USING ("status"::text::"BolaoStatus_new");
ALTER TABLE "bolao" ALTER COLUMN "status" SET DEFAULT 'ATIVO';
ALTER TYPE "BolaoStatus" RENAME TO "BolaoStatus_old";
ALTER TYPE "BolaoStatus_new" RENAME TO "BolaoStatus";
DROP TYPE "BolaoStatus_old";
COMMIT;
