-- AlterTable
ALTER TABLE "dati_icecat" ADD COLUMN "bulletPointsJson" TEXT;
ALTER TABLE "dati_icecat" ADD COLUMN "documentiJson" TEXT;

-- AlterTable
ALTER TABLE "fornitori" ADD COLUMN "ftpHost" TEXT;
ALTER TABLE "fornitori" ADD COLUMN "ftpPath" TEXT;
ALTER TABLE "fornitori" ADD COLUMN "ftpPort" INTEGER;
