/*
  Warnings:

  - You are about to drop the `dati_icecat` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `master_file` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `output_shopify` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `conteggioArticoli` on the `categorie` table. All the data in the column will be lost.
  - You are about to drop the column `conteggioArticoli` on the `marchi` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "dati_icecat_eanGtin_idx";

-- DropIndex
DROP INDEX "dati_icecat_masterFileId_key";

-- DropIndex
DROP INDEX "master_file_categoriaId_idx";

-- DropIndex
DROP INDEX "master_file_marchioId_idx";

-- DropIndex
DROP INDEX "master_file_eanGtin_idx";

-- DropIndex
DROP INDEX "master_file_eanGtin_key";

-- DropIndex
DROP INDEX "output_shopify_dataGenerazione_idx";

-- DropIndex
DROP INDEX "output_shopify_statoCaricamento_idx";

-- DropIndex
DROP INDEX "output_shopify_handle_key";

-- DropIndex
DROP INDEX "output_shopify_masterFileId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "dati_icecat";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "master_file";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "output_shopify";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_categorie" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "normalizzato" TEXT NOT NULL,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_categorie" ("attivo", "createdAt", "id", "nome", "normalizzato", "note", "updatedAt") SELECT "attivo", "createdAt", "id", "nome", "normalizzato", "note", "updatedAt" FROM "categorie";
DROP TABLE "categorie";
ALTER TABLE "new_categorie" RENAME TO "categorie";
CREATE UNIQUE INDEX "categorie_nome_key" ON "categorie"("nome");
CREATE INDEX "categorie_normalizzato_idx" ON "categorie"("normalizzato");
CREATE TABLE "new_marchi" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "normalizzato" TEXT NOT NULL,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_marchi" ("attivo", "createdAt", "id", "nome", "normalizzato", "note", "updatedAt") SELECT "attivo", "createdAt", "id", "nome", "normalizzato", "note", "updatedAt" FROM "marchi";
DROP TABLE "marchi";
ALTER TABLE "new_marchi" RENAME TO "marchi";
CREATE UNIQUE INDEX "marchi_nome_key" ON "marchi"("nome");
CREATE INDEX "marchi_normalizzato_idx" ON "marchi"("normalizzato");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
