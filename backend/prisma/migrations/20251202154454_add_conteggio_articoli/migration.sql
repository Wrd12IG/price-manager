/*
  Warnings:

  - You are about to drop the column `categoriaEcommerce` on the `master_file` table. All the data in the column will be lost.
  - You are about to drop the column `marca` on the `master_file` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[fornitoreId,campoStandard]` on the table `mappatura_campi` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "mappatura_campi_fornitoreId_campoOriginale_key";

-- CreateTable
CREATE TABLE "marchi" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "normalizzato" TEXT NOT NULL,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "conteggioArticoli" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "categorie" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "normalizzato" TEXT NOT NULL,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "conteggioArticoli" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "product_filter_rules" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "tipoFiltro" TEXT NOT NULL DEFAULT 'custom',
    "marchioId" INTEGER,
    "categoriaId" INTEGER,
    "azione" TEXT NOT NULL DEFAULT 'include',
    "priorita" INTEGER NOT NULL DEFAULT 1,
    "attiva" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "product_filter_rules_marchioId_fkey" FOREIGN KEY ("marchioId") REFERENCES "marchi" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "product_filter_rules_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorie" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "filter_presets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "descrizione" TEXT,
    "attivo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_master_file" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eanGtin" TEXT NOT NULL,
    "skuSelezionato" TEXT NOT NULL,
    "fornitoreSelezionatoId" INTEGER NOT NULL,
    "nomeProdotto" TEXT,
    "prezzoAcquistoMigliore" REAL NOT NULL,
    "prezzoVenditaCalcolato" REAL NOT NULL,
    "quantitaTotaleAggregata" INTEGER NOT NULL DEFAULT 0,
    "marchioId" INTEGER,
    "categoriaId" INTEGER,
    "dataUltimoAggiornamento" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "regolaMarkupId" INTEGER,
    CONSTRAINT "master_file_fornitoreSelezionatoId_fkey" FOREIGN KEY ("fornitoreSelezionatoId") REFERENCES "fornitori" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "master_file_marchioId_fkey" FOREIGN KEY ("marchioId") REFERENCES "marchi" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "master_file_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorie" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "master_file_regolaMarkupId_fkey" FOREIGN KEY ("regolaMarkupId") REFERENCES "regole_markup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_master_file" ("createdAt", "dataUltimoAggiornamento", "eanGtin", "fornitoreSelezionatoId", "id", "nomeProdotto", "prezzoAcquistoMigliore", "prezzoVenditaCalcolato", "quantitaTotaleAggregata", "regolaMarkupId", "skuSelezionato", "updatedAt") SELECT "createdAt", "dataUltimoAggiornamento", "eanGtin", "fornitoreSelezionatoId", "id", "nomeProdotto", "prezzoAcquistoMigliore", "prezzoVenditaCalcolato", "quantitaTotaleAggregata", "regolaMarkupId", "skuSelezionato", "updatedAt" FROM "master_file";
DROP TABLE "master_file";
ALTER TABLE "new_master_file" RENAME TO "master_file";
CREATE UNIQUE INDEX "master_file_eanGtin_key" ON "master_file"("eanGtin");
CREATE INDEX "master_file_eanGtin_idx" ON "master_file"("eanGtin");
CREATE INDEX "master_file_marchioId_idx" ON "master_file"("marchioId");
CREATE INDEX "master_file_categoriaId_idx" ON "master_file"("categoriaId");
CREATE TABLE "new_regole_markup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fornitoreId" INTEGER,
    "marchioId" INTEGER,
    "categoriaId" INTEGER,
    "tipoRegola" TEXT NOT NULL,
    "riferimento" TEXT,
    "markupPercentuale" REAL NOT NULL DEFAULT 0,
    "markupFisso" REAL NOT NULL DEFAULT 0,
    "costoSpedizione" REAL NOT NULL DEFAULT 0,
    "priorita" INTEGER NOT NULL DEFAULT 3,
    "dataInizioValidita" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataFineValidita" DATETIME,
    "attiva" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "regole_markup_fornitoreId_fkey" FOREIGN KEY ("fornitoreId") REFERENCES "fornitori" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "regole_markup_marchioId_fkey" FOREIGN KEY ("marchioId") REFERENCES "marchi" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "regole_markup_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorie" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_regole_markup" ("attiva", "costoSpedizione", "createdAt", "dataFineValidita", "dataInizioValidita", "fornitoreId", "id", "markupFisso", "markupPercentuale", "priorita", "riferimento", "tipoRegola", "updatedAt") SELECT "attiva", "costoSpedizione", "createdAt", "dataFineValidita", "dataInizioValidita", "fornitoreId", "id", "markupFisso", "markupPercentuale", "priorita", "riferimento", "tipoRegola", "updatedAt" FROM "regole_markup";
DROP TABLE "regole_markup";
ALTER TABLE "new_regole_markup" RENAME TO "regole_markup";
CREATE INDEX "regole_markup_tipoRegola_idx" ON "regole_markup"("tipoRegola");
CREATE INDEX "regole_markup_marchioId_idx" ON "regole_markup"("marchioId");
CREATE INDEX "regole_markup_categoriaId_idx" ON "regole_markup"("categoriaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "marchi_nome_key" ON "marchi"("nome");

-- CreateIndex
CREATE INDEX "marchi_normalizzato_idx" ON "marchi"("normalizzato");

-- CreateIndex
CREATE UNIQUE INDEX "categorie_nome_key" ON "categorie"("nome");

-- CreateIndex
CREATE INDEX "categorie_normalizzato_idx" ON "categorie"("normalizzato");

-- CreateIndex
CREATE INDEX "product_filter_rules_marchioId_idx" ON "product_filter_rules"("marchioId");

-- CreateIndex
CREATE INDEX "product_filter_rules_categoriaId_idx" ON "product_filter_rules"("categoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "mappatura_campi_fornitoreId_campoStandard_key" ON "mappatura_campi"("fornitoreId", "campoStandard");
