# Filtri Master File - Documentazione Completa

## 📋 Panoramica

Il sistema di filtri prodotti è ora completamente integrato con il processo di consolidamento del Master File. Quando si preme il pulsante **"Aggiorna con Filtri"** nella sezione Master File, vengono applicati automaticamente i filtri configurati nella sezione **Filtri Prodotti**.

## 🔄 Workflow Completo

### 1. Configurazione Filtri (Sezione "Filtri Prodotti")

**Percorso:** Frontend → Filtri Prodotti

**Funzionalità:**
- Creazione di regole di filtro basate su **Marchi** e **Categorie**
- Selezione tramite **Autocomplete** con FK (Foreign Key) verso tabelle `Marchio` e `Categoria`
- Ogni regola può essere:
  - **Attiva/Disattiva** (toggle switch)
  - **Include/Escludi** (azione)
  - **Priorità** (1-10)

**Logica Filtri:**
- **OR interno** (stesso gruppo): `Marca: [Asus, Dell]` → prodotti che sono Asus **OR** Dell
- **AND esterno** (gruppi diversi): `Marca: [Asus] + Categoria: [Notebook]` → prodotti che sono Asus **AND** Notebook

**Esempio:**
```
Regola 1: Marca = Asus, Categoria = Notebook → Include solo notebook Asus
Regola 2: Marca = Dell, Categoria = Desktop → Include solo desktop Dell
```

### 2. Consolidamento Master File

**Percorso:** Frontend → Master File → "Aggiorna con Filtri"

**Processo Backend (`MasterFileService.consolidaMasterFile()`):**

#### Step 1: Estrazione Prodotti Raw
```sql
WITH Ranked AS (
    SELECT t1.*,
        ROW_NUMBER() OVER (
            PARTITION BY t1.eanGtin 
            ORDER BY t1.prezzoAcquisto ASC, 
                     t1.quantitaDisponibile DESC
        ) as rn
    FROM listini_raw t1
    LEFT JOIN mappatura_categorie mc 
        ON t1.fornitoreId = mc.fornitoreId 
        AND t1.categoriaFornitore = mc.categoriaFornitore
    WHERE t1.eanGtin IS NOT NULL 
        AND t1.eanGtin != ''
        AND (mc.escludi IS NULL OR mc.escludi = 0)
)
SELECT * FROM Ranked WHERE rn = 1
```

**Risultato:** Prodotti unici per EAN con il prezzo più basso.

#### Step 2: Arricchimento Brand da Icecat
```typescript
// Recupera dati Icecat per gli EAN trovati
const icecatData = await prisma.datiIcecat.findMany({
    where: { eanGtin: { in: eans } },
    select: { 
        eanGtin: true, 
        specificheTecnicheJson: true, 
        descrizioneBrave: true 
    }
});

// Estrae il brand dalle specifiche tecniche
for (const item of icecatData) {
    const specs = JSON.parse(item.specificheTecnicheJson);
    const brand = IcecatService.extractBrandFromFeatures(specs);
    
    if (brand) {
        icecatBrands.set(item.eanGtin, brand);
    }
}
```

#### Step 3: Applicazione Filtri Prodotti ⭐
```typescript
const filterStats = await ProductFilterService.filterProducts(bestProducts);
filteredProducts = filterStats.includedProducts;

logger.info(`Filtro prodotti applicato:`);
logger.info(`- Prodotti totali: ${filterStats.totalProducts}`);
logger.info(`- Prodotti inclusi: ${filterStats.includedCount}`);
logger.info(`- Prodotti esclusi: ${filterStats.excludedCount}`);
```

**Logica di Filtro (`ProductFilterService.evaluateRules()`):**
1. Recupera tutte le regole attive dal database
2. Converte le FK (marchioId, categoriaId) in nomi
3. Applica la logica AND/OR:
   - Match brand: `productBrand IN [rule.brands]` (OR)
   - Match category: `productCategory IN [rule.categories]` (OR)
   - Risultato finale: `brandMatch AND categoryMatch`

#### Step 4: Mapping Marchi e Categorie a FK
```typescript
// Crea/Recupera ID per marchi e categorie
for (const p of filteredProducts) {
    if (p.marca) {
        const marchio = await prisma.marchio.upsert({
            where: { normalizzato: p.marca.toUpperCase() },
            create: { nome: p.marca, normalizzato: p.marca.toUpperCase() }
        });
        marchiMap.set(p.marca.toUpperCase(), marchio.id);
    }
}
```

#### Step 5: Upsert nel Master File
```typescript
for (const p of filteredProducts) {
    const data = {
        skuSelezionato: p.skuFornitore,
        fornitoreSelezionatoId: p.fornitoreId,
        prezzoAcquistoMigliore: parseFloat(p.prezzoAcquisto),
        quantitaTotaleAggregata: parseInt(p.quantitaTotale),
        marchioId: marchiMap.get(p.marca.toUpperCase()),
        categoriaId: categorieMap.get(p.categoriaFornitore.toUpperCase())
    };
    
    await prisma.masterFile.upsert({
        where: { eanGtin: p.eanGtin },
        create: { ...data, eanGtin: p.eanGtin },
        update: data
    });
}
```

#### Step 6: Rimozione Prodotti Filtrati
```typescript
// Rimuove prodotti non più presenti o esclusi dai filtri
await prisma.masterFile.deleteMany({
    where: { eanGtin: { notIn: Array.from(processedEans) } }
});
```

#### Step 7: Auto-Trigger Ricalcolo Prezzi
```typescript
const priceResult = await MarkupService.applicaRegolePrezzi();
logger.info(`✅ Prezzi ricalcolati: ${priceResult.updated} prodotti`);
```

## 🎯 Interfaccia Utente

### Master File Page

**Pulsanti:**
1. **"Ricarica Vista"** (outlined) → Ricarica solo la visualizzazione corrente
2. **"Aggiorna con Filtri"** (contained, gradient) → Esegue il consolidamento completo con applicazione filtri

**Funzionalità:**
- Ricerca per Nome, EAN, SKU, Marca
- Paginazione (25, 50, 100 righe)
- Visualizzazione:
  - EAN / SKU
  - Miglior Fornitore
  - Prezzo Acquisto
  - Prezzo Vendita (calcolato con markup)
  - Stock Totale
  - Ultimo Aggiornamento

### Filtri Prodotti Page

**Sezioni:**
1. **Preset Configurazioni** → Set predefiniti di regole
2. **Regole Attive** → Tabella con tutte le regole configurate
3. **Aggiungi Regola** → Modal con form per nuova regola
4. **Testa Filtro** → Modal per testare se un prodotto verrebbe incluso/escluso

**Form Nuova Regola:**
- Nome Regola (obbligatorio)
- Brand (Autocomplete con marchi esistenti)
- Categoria (Autocomplete con categorie esistenti)
- Azione (Include/Escludi)
- Priorità (1-10)
- Note (opzionale)
- Attiva (checkbox)

## 📊 Esempio Pratico

### Scenario: Voglio vendere solo notebook Asus e Dell

**Step 1: Configura Filtri**
```
Regola 1:
- Nome: "Notebook Asus"
- Brand: Asus
- Categoria: Notebook
- Azione: Include
- Attiva: ✓

Regola 2:
- Nome: "Notebook Dell"
- Brand: Dell
- Categoria: Notebook
- Azione: Include
- Attiva: ✓
```

**Step 2: Aggiorna Master File**
- Vai su "Master File"
- Clicca "Aggiorna con Filtri"
- Attendi il completamento

**Risultato:**
- Solo i notebook Asus e Dell saranno presenti nel Master File
- Tutti gli altri prodotti verranno rimossi
- I prezzi verranno ricalcolati automaticamente

## 🔍 Debug e Verifica

### Log Backend
```
Inizio consolidamento Master File...
Trovati 5000 prodotti unici per EAN.
Filtro prodotti applicato:
- Prodotti totali: 5000
- Prodotti inclusi: 250
- Prodotti esclusi: 4750
Esempi prodotti esclusi: HP - Desktop, Lenovo - Tablet, ...
Consolidamento completato. Creati: 150, Aggiornati: 100
🔄 Auto-trigger: Ricalcolo prezzi con regole markup attive...
✅ Prezzi ricalcolati: 250 prodotti aggiornati
```

### Test Manuale
1. Vai su "Filtri Prodotti"
2. Clicca "🧪 Testa Filtro"
3. Inserisci:
   - Brand: "Asus"
   - Categoria: "Notebook"
4. Clicca "Testa"
5. Risultato: ✅ Prodotto INCLUSO / ❌ Prodotto ESCLUSO

## ⚠️ Note Importanti

1. **Filtri Vuoti**: Se non ci sono regole attive, TUTTI i prodotti vengono inclusi
2. **Ordine Priorità**: Le regole vengono valutate in ordine di priorità (1 = massima)
3. **Brand Matching**: Usa word boundaries per evitare falsi positivi (es. ASUS ≠ ASUSTOR)
4. **Category Matching**: Case-insensitive con partial matching
5. **Auto-Ricalcolo**: I prezzi vengono sempre ricalcolati dopo il consolidamento
6. **FK Relations**: Marchi e Categorie usano FK per garantire integrità referenziale

## 🚀 Prossimi Passi

1. Configurare le regole di filtro desiderate
2. Testare con il tool "Testa Filtro"
3. Eseguire "Aggiorna con Filtri" nel Master File
4. Verificare i risultati nella tabella
5. Procedere con l'export verso Shopify
