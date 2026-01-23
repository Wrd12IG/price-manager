-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_regole_markup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fornitoreId" INTEGER,
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
    CONSTRAINT "regole_markup_fornitoreId_fkey" FOREIGN KEY ("fornitoreId") REFERENCES "fornitori" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_regole_markup" ("attiva", "costoSpedizione", "createdAt", "dataFineValidita", "dataInizioValidita", "id", "markupFisso", "markupPercentuale", "priorita", "riferimento", "tipoRegola", "updatedAt") SELECT "attiva", "costoSpedizione", "createdAt", "dataFineValidita", "dataInizioValidita", "id", "markupFisso", "markupPercentuale", "priorita", "riferimento", "tipoRegola", "updatedAt" FROM "regole_markup";
DROP TABLE "regole_markup";
ALTER TABLE "new_regole_markup" RENAME TO "regole_markup";
CREATE INDEX "regole_markup_tipoRegola_riferimento_idx" ON "regole_markup"("tipoRegola", "riferimento");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
