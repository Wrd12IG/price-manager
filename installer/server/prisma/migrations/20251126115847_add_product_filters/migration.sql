-- AlterTable
ALTER TABLE "output_shopify" ADD COLUMN "descrizioneBreve" TEXT;
ALTER TABLE "output_shopify" ADD COLUMN "metafieldsJson" TEXT;
ALTER TABLE "output_shopify" ADD COLUMN "specificheJson" TEXT;
ALTER TABLE "output_shopify" ADD COLUMN "variantCompareAtPrice" REAL;

-- CreateTable
CREATE TABLE "product_filter_rules" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "tipoFiltro" TEXT NOT NULL,
    "brand" TEXT,
    "categoria" TEXT,
    "azione" TEXT NOT NULL DEFAULT 'include',
    "priorita" INTEGER NOT NULL DEFAULT 1,
    "attiva" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "filter_presets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "descrizione" TEXT,
    "regoleJson" TEXT NOT NULL,
    "attivo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_mappatura_categorie" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fornitoreId" INTEGER NOT NULL,
    "categoriaFornitore" TEXT NOT NULL,
    "categoriaEcommerce" TEXT NOT NULL,
    "priorita" INTEGER NOT NULL DEFAULT 1,
    "escludi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "mappatura_categorie_fornitoreId_fkey" FOREIGN KEY ("fornitoreId") REFERENCES "fornitori" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_mappatura_categorie" ("categoriaEcommerce", "categoriaFornitore", "createdAt", "fornitoreId", "id", "priorita", "updatedAt") SELECT "categoriaEcommerce", "categoriaFornitore", "createdAt", "fornitoreId", "id", "priorita", "updatedAt" FROM "mappatura_categorie";
DROP TABLE "mappatura_categorie";
ALTER TABLE "new_mappatura_categorie" RENAME TO "mappatura_categorie";
CREATE UNIQUE INDEX "mappatura_categorie_fornitoreId_categoriaFornitore_key" ON "mappatura_categorie"("fornitoreId", "categoriaFornitore");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "product_filter_rules_tipoFiltro_idx" ON "product_filter_rules"("tipoFiltro");

-- CreateIndex
CREATE INDEX "product_filter_rules_brand_idx" ON "product_filter_rules"("brand");

-- CreateIndex
CREATE INDEX "product_filter_rules_categoria_idx" ON "product_filter_rules"("categoria");

-- CreateIndex
CREATE INDEX "product_filter_rules_attiva_idx" ON "product_filter_rules"("attiva");

-- CreateIndex
CREATE UNIQUE INDEX "filter_presets_nome_key" ON "filter_presets"("nome");
