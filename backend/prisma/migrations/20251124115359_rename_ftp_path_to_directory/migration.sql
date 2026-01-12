/*
  Warnings:

  - You are about to drop the column `ftpPath` on the `fornitori` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_fornitori" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nomeFornitore" TEXT NOT NULL,
    "urlListino" TEXT,
    "formatoFile" TEXT NOT NULL,
    "tipoAccesso" TEXT NOT NULL,
    "username" TEXT,
    "passwordEncrypted" TEXT,
    "ftpHost" TEXT,
    "ftpPort" INTEGER,
    "ftpDirectory" TEXT,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "ultimaSincronizzazione" DATETIME,
    "frequenzaAggiornamento" TEXT NOT NULL DEFAULT 'daily',
    "cronExpression" TEXT,
    "encoding" TEXT NOT NULL DEFAULT 'UTF-8',
    "separatoreCSV" TEXT NOT NULL DEFAULT ';',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_fornitori" ("attivo", "createdAt", "cronExpression", "encoding", "formatoFile", "frequenzaAggiornamento", "ftpHost", "ftpPort", "id", "nomeFornitore", "passwordEncrypted", "separatoreCSV", "tipoAccesso", "ultimaSincronizzazione", "updatedAt", "urlListino", "username") SELECT "attivo", "createdAt", "cronExpression", "encoding", "formatoFile", "frequenzaAggiornamento", "ftpHost", "ftpPort", "id", "nomeFornitore", "passwordEncrypted", "separatoreCSV", "tipoAccesso", "ultimaSincronizzazione", "updatedAt", "urlListino", "username" FROM "fornitori";
DROP TABLE "fornitori";
ALTER TABLE "new_fornitori" RENAME TO "fornitori";
CREATE UNIQUE INDEX "fornitori_nomeFornitore_key" ON "fornitori"("nomeFornitore");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
