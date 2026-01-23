-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_master_file" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eanGtin" TEXT NOT NULL,
    "skuSelezionato" TEXT NOT NULL,
    "fornitoreSelezionatoId" INTEGER NOT NULL,
    "prezzoAcquistoMigliore" REAL NOT NULL,
    "prezzoVenditaCalcolato" REAL NOT NULL,
    "quantitaTotaleAggregata" INTEGER NOT NULL DEFAULT 0,
    "categoriaEcommerce" TEXT,
    "marca" TEXT,
    "dataUltimoAggiornamento" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "regolaMarkupId" INTEGER,
    CONSTRAINT "master_file_fornitoreSelezionatoId_fkey" FOREIGN KEY ("fornitoreSelezionatoId") REFERENCES "fornitori" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "master_file_regolaMarkupId_fkey" FOREIGN KEY ("regolaMarkupId") REFERENCES "regole_markup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_master_file" ("categoriaEcommerce", "createdAt", "dataUltimoAggiornamento", "eanGtin", "fornitoreSelezionatoId", "id", "marca", "prezzoAcquistoMigliore", "prezzoVenditaCalcolato", "quantitaTotaleAggregata", "skuSelezionato", "updatedAt") SELECT "categoriaEcommerce", "createdAt", "dataUltimoAggiornamento", "eanGtin", "fornitoreSelezionatoId", "id", "marca", "prezzoAcquistoMigliore", "prezzoVenditaCalcolato", "quantitaTotaleAggregata", "skuSelezionato", "updatedAt" FROM "master_file";
DROP TABLE "master_file";
ALTER TABLE "new_master_file" RENAME TO "master_file";
CREATE UNIQUE INDEX "master_file_eanGtin_key" ON "master_file"("eanGtin");
CREATE INDEX "master_file_eanGtin_idx" ON "master_file"("eanGtin");
CREATE INDEX "master_file_marca_idx" ON "master_file"("marca");
CREATE INDEX "master_file_categoriaEcommerce_idx" ON "master_file"("categoriaEcommerce");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
