/*
  Warnings:

  - You are about to drop the `filter_presets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `product_filter_rules` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "filter_presets";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "product_filter_rules";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "supplier_filters" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fornitoreId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "marcheIncluse" TEXT,
    "marcheEscluse" TEXT,
    "categorieIncluse" TEXT,
    "categorieEscluse" TEXT,
    "eanInclusi" TEXT,
    "eanEsclusi" TEXT,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "supplier_filters_fornitoreId_fkey" FOREIGN KEY ("fornitoreId") REFERENCES "fornitori" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "supplier_filters_fornitoreId_idx" ON "supplier_filters"("fornitoreId");

-- CreateIndex
CREATE INDEX "supplier_filters_attivo_idx" ON "supplier_filters"("attivo");
