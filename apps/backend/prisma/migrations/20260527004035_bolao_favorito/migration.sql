-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "bolaoFavoritoId" TEXT;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_bolaoFavoritoId_fkey" FOREIGN KEY ("bolaoFavoritoId") REFERENCES "bolao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
