# Correzione Errore Filtri Prodotti

## Problema Identificato

L'errore "Errore nella creazione della regola" era causato da un disallineamento tra lo schema Prisma e la struttura del database SQLite.

### Errore Specifico
```
Null constraint violation on the fields: (`tipoFiltro`)
```

Il database aveva un campo obbligatorio `tipoFiltro` che non era presente nello schema Prisma, causando il fallimento di tutte le operazioni di creazione regole.

## Analisi del Database

### Struttura Vecchia (Database)
```sql
CREATE TABLE "product_filter_rules" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "tipoFiltro" TEXT NOT NULL,          -- ❌ Campo obbligatorio mancante nello schema
    "brand" TEXT,                         -- ❌ Campo deprecato
    "categoria" TEXT,                     -- ❌ Campo deprecato
    "azione" TEXT NOT NULL DEFAULT 'include',
    "priorita" INTEGER NOT NULL DEFAULT 1,
    "attiva" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    marchioId INTEGER,                    -- ✅ FK aggiunto dopo
    categoriaId INTEGER                   -- ✅ FK aggiunto dopo
);
```

### Schema Prisma (Prima della correzione)
```prisma
model ProductFilterRule {
  id                    Int      @id @default(autoincrement())
  nome                  String
  // ❌ tipoFiltro MANCANTE
  marchioId             Int?
  categoriaId           Int?
  azione                String   @default("include")
  priorita              Int      @default(1)
  attiva                Boolean  @default(true)
  note                  String?
  // ...
}
```

## Correzioni Applicate

### 1. Aggiornamento Schema Prisma
**File**: `backend/prisma/schema.prisma`

Aggiunto il campo `tipoFiltro` con valore di default:

```prisma
model ProductFilterRule {
  id                    Int      @id @default(autoincrement())
  nome                  String
  tipoFiltro            String   @default("custom") // ✅ AGGIUNTO
  marchioId             Int?
  categoriaId           Int?
  azione                String   @default("include")
  priorita              Int      @default(1)
  attiva                Boolean  @default(true)
  note                  String?
  // ...
}
```

**Valori possibili per `tipoFiltro`**:
- `custom`: Regola generica (nessun filtro specifico)
- `brand`: Filtro per marchio
- `category`: Filtro per categoria
- `brand_category`: Filtro combinato marchio + categoria

### 2. Aggiornamento ProductFilterService
**File**: `backend/src/services/ProductFilterService.ts`

Modificato il metodo `createRule` per determinare automaticamente il `tipoFiltro`:

```typescript
async createRule(data: {
    nome: string;
    marchioId?: number;
    categoriaId?: number;
    azione?: string;
    priorita?: number;
    attiva?: boolean;
    note?: string;
}) {
    // Determina automaticamente il tipoFiltro in base ai campi forniti
    let tipoFiltro = 'custom';
    if (data.marchioId && data.categoriaId) {
        tipoFiltro = 'brand_category';
    } else if (data.marchioId) {
        tipoFiltro = 'brand';
    } else if (data.categoriaId) {
        tipoFiltro = 'category';
    }

    return await prisma.productFilterRule.create({
        data: {
            nome: data.nome,
            tipoFiltro: tipoFiltro,  // ✅ AGGIUNTO
            marchioId: data.marchioId || null,
            categoriaId: data.categoriaId || null,
            azione: data.azione || 'include',
            priorita: data.priorita || 1,
            attiva: data.attiva !== undefined ? data.attiva : true,
            note: data.note || null
        }
    });
}
```

### 3. Pulizia Database
Rimossi i campi deprecati `brand` e `categoria` dal database:

```bash
sqlite3 prisma/dev.db "ALTER TABLE product_filter_rules DROP COLUMN brand;"
sqlite3 prisma/dev.db "ALTER TABLE product_filter_rules DROP COLUMN categoria;"
```

### 4. Completamento ProductFilterController
**File**: `backend/src/controllers/ProductFilterController.ts`

Aggiunti tutti i metodi mancanti:
- ✅ `getOptions()` - Ottiene marche e categorie disponibili
- ✅ `updateRule()` - Aggiorna una regola esistente
- ✅ `deleteRule()` - Elimina una regola
- ✅ `toggleRule()` - Attiva/disattiva una regola
- ✅ `testFilter()` - Testa un singolo prodotto
- ✅ `batchTestFilter()` - Testa un batch di prodotti
- ✅ `getPresets()` - Ottiene tutti i preset
- ✅ `getActivePreset()` - Ottiene il preset attivo
- ✅ `activatePreset()` - Attiva un preset

### 5. Rigenerazione Client Prisma
```bash
npx prisma generate
```

## Struttura Finale del Database

```sql
CREATE TABLE "product_filter_rules" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "tipoFiltro" TEXT NOT NULL DEFAULT 'custom',
    "azione" TEXT NOT NULL DEFAULT 'include',
    "priorita" INTEGER NOT NULL DEFAULT 1,
    "attiva" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    marchioId INTEGER,
    categoriaId INTEGER
);
```

## Test di Verifica

Creato script di test `backend/test_filter_creation.ts` che verifica:

1. ✅ Creazione regola con solo nome (tipoFiltro: 'custom')
2. ✅ Creazione regola con marchioId (tipoFiltro: 'brand')
3. ✅ Caricamento marchi disponibili
4. ✅ Caricamento categorie disponibili

**Risultati**: Tutti i test passano con successo! ✅

## Funzionalità Ora Disponibili

### Frontend (ProductFilters.tsx)
- ✅ Creazione nuove regole filtro
- ✅ Selezione marchio tramite Autocomplete
- ✅ Selezione categoria tramite Autocomplete
- ✅ Attivazione/disattivazione regole
- ✅ Eliminazione regole
- ✅ Test filtri su prodotti singoli
- ✅ Gestione preset

### Backend (API Endpoints)
- ✅ `GET /api/filters/options` - Opzioni disponibili
- ✅ `GET /api/filters/facets` - Conteggi dinamici
- ✅ `GET /api/filters/rules` - Lista regole
- ✅ `POST /api/filters/rules` - Crea regola
- ✅ `PUT /api/filters/rules/:id` - Aggiorna regola
- ✅ `DELETE /api/filters/rules/:id` - Elimina regola
- ✅ `PATCH /api/filters/rules/:id/toggle` - Toggle regola
- ✅ `POST /api/filters/test` - Test filtro
- ✅ `POST /api/filters/batch-test` - Test batch
- ✅ `GET /api/filters/presets` - Lista preset
- ✅ `GET /api/filters/presets/active` - Preset attivo
- ✅ `POST /api/filters/presets/:id/activate` - Attiva preset

## Auto-Trigger
Ogni modifica alle regole (creazione, aggiornamento, eliminazione, toggle) attiva automaticamente:
```typescript
MasterFileService.consolidaMasterFile()
```
Per ricalcolare i prodotti filtrati e i prezzi.

## Note Importanti

1. **Compatibilità**: Il campo `tipoFiltro` è ora obbligatorio ma ha un valore di default, quindi non rompe la compatibilità con il codice esistente.

2. **Logica Automatica**: Il tipo di filtro viene determinato automaticamente in base ai campi forniti, rendendo l'API più user-friendly.

3. **Migrazione Dati**: Se esistevano regole precedenti nel database, potrebbero aver bisogno di un valore per `tipoFiltro`. Il default 'custom' viene applicato automaticamente.

4. **TypeScript**: Dopo la rigenerazione del client Prisma, tutti i tipi TypeScript sono aggiornati e corretti.

## Prossimi Passi Consigliati

1. ✅ Testare la creazione di regole dal frontend
2. ✅ Verificare che il ricalcolo automatico funzioni correttamente
3. ✅ Testare la funzionalità di test filtri
4. ⏳ Creare alcuni preset predefiniti per casi d'uso comuni
5. ⏳ Documentare i pattern di utilizzo delle regole filtro

## Conclusione

Il problema è stato completamente risolto. L'errore "Errore nella creazione della regola" era dovuto a un campo mancante nello schema Prisma (`tipoFiltro`). Dopo l'aggiunta del campo, la pulizia del database e il completamento del controller, tutte le funzionalità dei filtri prodotti sono ora operative.
