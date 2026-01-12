# 🔧 Fix: Ricalcolo Automatico Prezzi e Filtri Migliorati

## 📋 Problemi Identificati

### 1. ❌ Markup Non Ricalcola Automaticamente
**Scenario:**
- Utente scarica listino → Applica filtro (es. solo ASUS) → Applica markup 20%
- Utente rimuove filtro → Nuovi prodotti entrano nel MasterFile
- **Problema**: I nuovi prodotti NON hanno il markup applicato

**Causa**: `MarkupService.applicaRegolePrezzi()` viene chiamato solo manualmente

### 2. ❌ Filtro Prodotti Poco Intuitivo
**Scenario:**
- Utente vuole filtrare prodotti per marca
- **Problema**: Le marche sono mischiate tra tutti i listini/fornitori
- **Esempio**: "ASUS" può apparire in Runner, Ingram, Tech Data con prezzi diversi

**Causa**: `getAvailableOptions()` non filtra per fornitore

## ✅ Soluzioni Implementate

### Soluzione 1: Auto-Trigger Ricalcolo Prezzi

#### A. Trigger dopo modifica filtri
Quando si modifica/rimuove un filtro, ricalcola automaticamente i prezzi.

**File**: `backend/src/routes/filters.ts` (o controller dei filtri)

```typescript
// Dopo aver modificato/eliminato una regola di filtro
await productFilterService.updateRule(id, data);

// AUTO-TRIGGER: Ricalcola prezzi per i nuovi prodotti
await MarkupService.applicaRegolePrezzi();
```

#### B. Trigger dopo modifica regole markup
Quando si crea/modifica/elimina una regola di markup, ricalcola automaticamente.

**File**: `backend/src/routes/markup.ts` (o controller del markup)

```typescript
// Dopo aver creato/modificato una regola
await MarkupService.createRegola(data);

// AUTO-TRIGGER: Ricalcola tutti i prezzi
await MarkupService.applicaRegolePrezzi();
```

#### C. Trigger dopo consolidamento
Quando si esegue il consolidamento (MasterFile viene aggiornato), ricalcola prezzi.

**File**: `backend/src/services/MasterFileService.ts`

```typescript
// Alla fine di consolidaListini()
logger.info('Consolidamento completato. Ricalcolo prezzi...');
await MarkupService.applicaRegolePrezzi();
```

### Soluzione 2: Filtri Gerarchici (Fornitore → Marca → Categoria)

#### A. Aggiungere filtro per fornitore
Modificare `getAvailableOptions()` per accettare `fornitoreId` opzionale.

**File**: `backend/src/services/ProductFilterService.ts`

```typescript
async getAvailableOptions(fornitoreId?: number) {
    const brands = new Set<string>();
    const categories = new Set<string>();

    // Query base
    let whereClause: any = {};
    
    // Se fornitoreId è specificato, filtra per fornitore
    if (fornitoreId) {
        whereClause.fornitoreSelezionatoId = fornitoreId;
    }

    // Recupera prodotti filtrati per fornitore
    const prodotti = await prisma.masterFile.findMany({
        where: whereClause,
        include: {
            datiIcecat: true,
            outputShopify: true,
            fornitoreSelezionato: true  // Include info fornitore
        }
    });

    // ... resto del codice per estrarre marche e categorie
}
```

#### B. Endpoint API per fornitori
Aggiungere endpoint per ottenere lista fornitori.

**File**: `backend/src/routes/filters.ts`

```typescript
// GET /api/filters/fornitori
router.get('/fornitori', async (req, res) => {
    const fornitori = await prisma.fornitore.findMany({
        select: {
            id: true,
            nomeFornitore: true
        },
        orderBy: { nomeFornitore: 'asc' }
    });
    
    res.json(fornitori);
});

// GET /api/filters/options?fornitoreId=123
router.get('/options', async (req, res) => {
    const fornitoreId = req.query.fornitoreId 
        ? parseInt(req.query.fornitoreId as string) 
        : undefined;
    
    const service = new ProductFilterService();
    const options = await service.getAvailableOptions(fornitoreId);
    
    res.json(options);
});
```

#### C. UI Gerarchica
Modificare il frontend per mostrare filtri in cascata:

```
1. Seleziona Fornitore: [Dropdown: Tutti | Runner | Ingram | Tech Data]
   ↓
2. Seleziona Marca: [Dropdown: filtrato per fornitore selezionato]
   ↓
3. Seleziona Categoria: [Dropdown: filtrato per fornitore + marca]
```

## 🔄 Flusso Ottimizzato

### Prima (❌):
```
1. Importa listino Runner
2. Applica filtro (solo ASUS)
3. Consolida → 50 prodotti ASUS nel MasterFile
4. Applica markup 20% → 50 prodotti con markup
5. Rimuovi filtro
6. Consolida → 500 prodotti nel MasterFile
7. ❌ Solo 50 prodotti hanno markup, 450 no!
```

### Dopo (✅):
```
1. Importa listino Runner
2. Applica filtro (solo ASUS)
3. Consolida → 50 prodotti ASUS nel MasterFile
   → AUTO-TRIGGER: Ricalcola prezzi
4. Applica markup 20% → 50 prodotti con markup
   → AUTO-TRIGGER: Ricalcola prezzi
5. Rimuovi filtro
   → AUTO-TRIGGER: Ricalcola prezzi
6. Consolida → 500 prodotti nel MasterFile
   → AUTO-TRIGGER: Ricalcola prezzi
7. ✅ Tutti i 500 prodotti hanno markup corretto!
```

## 📊 Vantaggi

### Auto-Trigger Prezzi:
- ✅ Nessun prodotto "dimenticato" senza markup
- ✅ Prezzi sempre aggiornati
- ✅ Meno errori manuali
- ✅ Workflow più fluido

### Filtri Gerarchici:
- ✅ Più intuitivo: prima scelgo il fornitore, poi la marca
- ✅ Meno confusione: marche separate per fornitore
- ✅ Più veloce: meno opzioni da scorrere
- ✅ Più preciso: evita conflitti tra fornitori

## ⚠️ Considerazioni Performance

### Auto-Trigger Prezzi
- `applicaRegolePrezzi()` processa tutti i prodotti (può richiedere tempo)
- **Soluzione**: Mostrare progress bar durante il ricalcolo
- **Alternativa**: Ricalcolare solo i prodotti nuovi/modificati (ottimizzazione futura)

### Filtri Gerarchici
- Query aggiuntiva per ottenere fornitori
- **Impatto**: Minimo (pochi fornitori, query veloce)

## 🚀 Implementazione

### Priorità Alta (Immediate):
1. ✅ Auto-trigger dopo consolidamento
2. ✅ Auto-trigger dopo modifica markup
3. ✅ Filtro per fornitore in getAvailableOptions()

### Priorità Media (Prossime):
4. Auto-trigger dopo modifica filtri
5. Endpoint API per fornitori
6. UI gerarchica frontend

### Priorità Bassa (Future):
7. Ottimizzazione: ricalcola solo prodotti modificati
8. Cache per opzioni filtri
9. Batch processing asincrono

## 📝 Note Tecniche

### Transazioni
Usare transazioni per garantire consistenza:

```typescript
await prisma.$transaction(async (tx) => {
    // 1. Modifica filtro
    await tx.productFilterRule.update(...);
    
    // 2. Ricalcola prezzi
    await MarkupService.applicaRegolePrezzi();
});
```

### Logging
Aggiungere log dettagliati:

```typescript
logger.info('Filtro modificato. Auto-trigger ricalcolo prezzi...');
const result = await MarkupService.applicaRegolePrezzi();
logger.info(`Prezzi ricalcolati: ${result.updated} prodotti aggiornati`);
```

### Notifiche UI
Mostrare notifica all'utente:

```typescript
res.json({
    success: true,
    message: 'Filtro aggiornato. Ricalcolo prezzi in corso...',
    pricesRecalculated: result.updated
});
```

---

**Status**: 📋 Documento di design  
**Prossimo step**: Implementare auto-trigger in MasterFileService e MarkupService  
**Tempo stimato**: 30-45 minuti
