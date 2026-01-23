-- CreateTable
CREATE TABLE "fornitori" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nomeFornitore" TEXT NOT NULL,
    "urlListino" TEXT,
    "formatoFile" TEXT NOT NULL,
    "tipoAccesso" TEXT NOT NULL,
    "username" TEXT,
    "passwordEncrypted" TEXT,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "ultimaSincronizzazione" DATETIME,
    "frequenzaAggiornamento" TEXT NOT NULL DEFAULT 'daily',
    "cronExpression" TEXT,
    "encoding" TEXT NOT NULL DEFAULT 'UTF-8',
    "separatoreCSV" TEXT NOT NULL DEFAULT ';',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "mappatura_campi" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fornitoreId" INTEGER NOT NULL,
    "campoOriginale" TEXT NOT NULL,
    "campoStandard" TEXT NOT NULL,
    "tipoDato" TEXT NOT NULL DEFAULT 'string',
    "trasformazioneRichiesta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "mappatura_campi_fornitoreId_fkey" FOREIGN KEY ("fornitoreId") REFERENCES "fornitori" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mappatura_categorie" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fornitoreId" INTEGER NOT NULL,
    "categoriaFornitore" TEXT NOT NULL,
    "categoriaEcommerce" TEXT NOT NULL,
    "priorita" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "mappatura_categorie_fornitoreId_fkey" FOREIGN KEY ("fornitoreId") REFERENCES "fornitori" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "regole_markup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "listini_raw" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fornitoreId" INTEGER NOT NULL,
    "dataImportazione" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "skuFornitore" TEXT NOT NULL,
    "eanGtin" TEXT,
    "descrizioneOriginale" TEXT,
    "prezzoAcquisto" REAL NOT NULL,
    "quantitaDisponibile" INTEGER NOT NULL DEFAULT 0,
    "categoriaFornitore" TEXT,
    "marca" TEXT,
    "altriCampiJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "listini_raw_fornitoreId_fkey" FOREIGN KEY ("fornitoreId") REFERENCES "fornitori" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "master_file" (
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
    CONSTRAINT "master_file_fornitoreSelezionatoId_fkey" FOREIGN KEY ("fornitoreSelezionatoId") REFERENCES "fornitori" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "variantInventoryQty" INTEGER NOT NULL,
    "immaginiUrls" TEXT,
    "dataGenerazione" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statoCaricamento" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "shopifyProductId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "output_shopify_masterFileId_fkey" FOREIGN KEY ("masterFileId") REFERENCES "master_file" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "log_elaborazioni" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dataEsecuzione" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "faseProcesso" TEXT NOT NULL,
    "stato" TEXT NOT NULL,
    "dettagliJson" TEXT,
    "durataSecondi" INTEGER,
    "prodottiProcessati" INTEGER NOT NULL DEFAULT 0,
    "prodottiErrore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "configurazione_sistema" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chiave" TEXT NOT NULL,
    "valore" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'string',
    "descrizione" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "utenti" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "ruolo" TEXT NOT NULL DEFAULT 'admin',
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAccesso" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "fornitori_nomeFornitore_key" ON "fornitori"("nomeFornitore");

-- CreateIndex
CREATE UNIQUE INDEX "mappatura_campi_fornitoreId_campoOriginale_key" ON "mappatura_campi"("fornitoreId", "campoOriginale");

-- CreateIndex
CREATE UNIQUE INDEX "mappatura_categorie_fornitoreId_categoriaFornitore_key" ON "mappatura_categorie"("fornitoreId", "categoriaFornitore");

-- CreateIndex
CREATE INDEX "regole_markup_tipoRegola_riferimento_idx" ON "regole_markup"("tipoRegola", "riferimento");

-- CreateIndex
CREATE INDEX "listini_raw_fornitoreId_skuFornitore_idx" ON "listini_raw"("fornitoreId", "skuFornitore");

-- CreateIndex
CREATE INDEX "listini_raw_eanGtin_idx" ON "listini_raw"("eanGtin");

-- CreateIndex
CREATE INDEX "listini_raw_dataImportazione_idx" ON "listini_raw"("dataImportazione");

-- CreateIndex
CREATE UNIQUE INDEX "master_file_eanGtin_key" ON "master_file"("eanGtin");

-- CreateIndex
CREATE INDEX "master_file_eanGtin_idx" ON "master_file"("eanGtin");

-- CreateIndex
CREATE INDEX "master_file_marca_idx" ON "master_file"("marca");

-- CreateIndex
CREATE INDEX "master_file_categoriaEcommerce_idx" ON "master_file"("categoriaEcommerce");

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

-- CreateIndex
CREATE INDEX "log_elaborazioni_dataEsecuzione_idx" ON "log_elaborazioni"("dataEsecuzione");

-- CreateIndex
CREATE INDEX "log_elaborazioni_faseProcesso_idx" ON "log_elaborazioni"("faseProcesso");

-- CreateIndex
CREATE INDEX "log_elaborazioni_stato_idx" ON "log_elaborazioni"("stato");

-- CreateIndex
CREATE UNIQUE INDEX "configurazione_sistema_chiave_key" ON "configurazione_sistema"("chiave");

-- CreateIndex
CREATE UNIQUE INDEX "utenti_email_key" ON "utenti"("email");
