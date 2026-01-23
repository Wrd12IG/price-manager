-- CreateTable
CREATE TABLE "master_file" (
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

-- CreateTable
CREATE TABLE "dati_icecat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "masterFileId" INTEGER NOT NULL,
    "eanGtin" TEXT NOT NULL,
    "descrizioneBrave" TEXT,
    "descrizioneLunga" TEXT,
    "specificheTecnicheJson" TEXT,
    "urlImmaginiJson" TEXT,
    "bulletPointsJson" TEXT,
    "documentiJson" TEXT,
    "linguaOriginale" TEXT NOT NULL DEFAULT 'it',
    "dataScaricamento" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "dati_icecat_masterFileId_fkey" FOREIGN KEY ("masterFileId") REFERENCES "master_file" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "output_shopify" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "masterFileId" INTEGER NOT NULL,
    "handle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "vendor" TEXT,
    "productType" TEXT,
    "tags" TEXT,
    "variantPrice" REAL NOT NULL,
    "variantCompareAtPrice" REAL,
    "variantInventoryQty" INTEGER NOT NULL,
    "immaginiUrls" TEXT,
    "descrizioneBreve" TEXT,
    "specificheJson" TEXT,
    "metafieldsJson" TEXT,
    "dataGenerazione" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statoCaricamento" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "shopifyProductId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "output_shopify_masterFileId_fkey" FOREIGN KEY ("masterFileId") REFERENCES "master_file" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "master_file_eanGtin_key" ON "master_file"("eanGtin");

-- CreateIndex
CREATE INDEX "master_file_eanGtin_idx" ON "master_file"("eanGtin");

-- CreateIndex
CREATE INDEX "master_file_marchioId_idx" ON "master_file"("marchioId");

-- CreateIndex
CREATE INDEX "master_file_categoriaId_idx" ON "master_file"("categoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "dati_icecat_masterFileId_key" ON "dati_icecat"("masterFileId");

-- CreateIndex
CREATE INDEX "dati_icecat_eanGtin_idx" ON "dati_icecat"("eanGtin");

-- CreateIndex
CREATE UNIQUE INDEX "output_shopify_masterFileId_key" ON "output_shopify"("masterFileId");

-- CreateIndex
CREATE UNIQUE INDEX "output_shopify_handle_key" ON "output_shopify"("handle");

-- CreateIndex
CREATE INDEX "output_shopify_statoCaricamento_idx" ON "output_shopify"("statoCaricamento");

-- CreateIndex
CREATE INDEX "output_shopify_dataGenerazione_idx" ON "output_shopify"("dataGenerazione");
