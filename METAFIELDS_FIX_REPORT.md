# 🔧 Fix Trasmissione Metafields a Shopify

## 📋 Problema Identificato

I metafields **non venivano trasmessi** a Shopify perché:

1. **API Shopify non supporta metafields nell'endpoint `/products.json`**
   - I metafields erano inclusi nel payload del prodotto (riga 747)
   - Ma Shopify **ignora** il campo `metafields` in questo endpoint
   - Richiede una chiamata separata all'endpoint `/products/{id}/metafields.json`

2. **Mancava la logica di sincronizzazione separata**
   - Dopo la creazione/aggiornamento del prodotto
   - Bisogna fare chiamate individuali per ogni metafield

## ✅ Modifiche Applicate

### 1. **Rimosso metafields dal payload principale** (righe 766-786)
```typescript
// Prima (NON FUNZIONAVA):
productData = {
    product: {
        title: p.title,
        metafields: metafields,  // ❌ Ignorato da Shopify
        ...
    }
};

// Dopo (CORRETTO):
const createData = { ...productData };
delete createData.product.metafields;  // ✅ Rimosso
```

### 2. **Aggiunta sincronizzazione separata metafields** (righe 788-828)
```typescript
// Dopo creazione/aggiornamento prodotto:
if (metafields && metafields.length > 0) {
    for (const metafield of metafields) {
        await axios.post(
            `https://${shopUrl}/admin/api/${apiVersion}/products/${productId}/metafields.json`,
            {
                metafield: {
                    namespace: metafield.namespace,
                    key: metafield.key,
                    value: metafield.value,
                    type: metafield.type
                }
            },
            { headers: { 'X-Shopify-Access-Token': accessToken } }
        );
        await new Promise(r => setTimeout(r, 100)); // Rate limiting
    }
}
```

### 3. **Gestione errori metafields**
- Se un metafield esiste già (errore 422), viene loggato ma non blocca il processo
- Gli errori sui metafields non impediscono il caricamento del prodotto
- Ogni metafield ha un delay di 100ms per rispettare i rate limits

### 4. **Fix scope variabile metafields** (riga 710)
- Spostata dichiarazione `metafields` fuori dal blocco try
- Ora accessibile anche nel blocco catch per gestione errori 404

## 📊 Metafields Generati

Il sistema genera automaticamente questi metafields per ogni prodotto:

### Informazioni Base
- `custom.codice_ean` - Codice EAN/GTIN
- `custom.marca_produttore` - Marca del produttore
- `custom.categoria_prodotto` - Categoria e-commerce
- `custom.info_disponibilita` - Disponibilità (es. "5 unità")

### Specifiche Tecniche
- `custom.spec_cpu` - Processore
- `custom.spec_ram` - Memoria RAM
- `custom.spec_storage` - Archiviazione
- `custom.spec_display` - Display
- `custom.spec_os` - Sistema operativo
- `custom.spec_gpu` - Scheda grafica
- `custom.spec_display_type` - Tipo display

### Descrizioni
- `custom.descrizione_breve` - Descrizione breve da Icecat
- `custom.descrizione_lunga` - Descrizione lunga da Icecat
- `custom.testo_marketing` - Testo marketing generato

### Altro
- `custom.scheda_pdf` - Link PDF scheda tecnica
- `custom.tabella_specifiche` - JSON con tutte le specifiche

## 🚀 Come Testare

### 1. Prepara i prodotti per l'export
```bash
# Via API
curl -X POST http://localhost:3001/api/shopify/prepare

# Oppure via dashboard
# Vai su Shopify → Prepare Export
```

### 2. Verifica che i metafields siano stati generati
```bash
npx ts-node src/scripts/check_metafields.ts
```

Dovresti vedere output tipo:
```
Products with metafields: 84
Metafields count: 15
Metafields:
  - custom.codice_ean: 4711387252970
  - custom.marca_produttore: ASUS
  - custom.spec_cpu: Intel Core i3-1215U
  ...
```

### 3. Sincronizza con Shopify
```bash
# Via API
curl -X POST http://localhost:3001/api/shopify/sync

# Oppure via dashboard
# Vai su Shopify → Sync to Shopify
```

### 4. Verifica su Shopify
1. Vai su Shopify Admin
2. Apri un prodotto sincronizzato
3. Scorri fino a "Metafields"
4. Dovresti vedere tutti i metafields sotto il namespace "custom"

## ⚠️ Note Importanti

### Rate Limiting
- **100ms** tra ogni metafield dello stesso prodotto
- **500ms** tra ogni prodotto
- **2 secondi** tra ogni batch di 50 prodotti

Questo significa che per un prodotto con 15 metafields:
- Tempo prodotto: ~1.5 secondi (15 × 100ms)
- Tempo totale 100 prodotti: ~3-4 minuti

### Gestione Errori
- Se un metafield fallisce, viene loggato ma il processo continua
- Il prodotto viene comunque marcato come "uploaded"
- Controlla i log per vedere eventuali metafields non sincronizzati

### Metafields Esistenti
- Se un metafield esiste già su Shopify, la creazione fallisce con errore 422
- Attualmente viene solo loggato
- Per aggiornare metafields esistenti, serve implementare la logica di GET + PUT

## 📁 File Modificati

- `backend/src/services/ShopifyService.ts`
  - Linee 708-710: Spostata dichiarazione metafields
  - Linee 766-786: Rimosso metafields dal payload
  - Linee 788-828: Aggiunta sync metafields separata
  - Linee 847-895: Aggiunta sync metafields in error recovery

## 🎯 Risultato Atteso

Dopo la sincronizzazione, ogni prodotto su Shopify avrà:
- ✅ Titolo ottimizzato
- ✅ Descrizione HTML ricca
- ✅ Immagini da Icecat
- ✅ Prezzo e inventario
- ✅ **15+ metafields custom** con tutte le specifiche tecniche

I metafields saranno utilizzabili:
- Nel tema Shopify (Liquid)
- Nelle app di terze parti
- Nei filtri di ricerca
- Nelle schede prodotto personalizzate

---

**Data fix**: 2025-11-29  
**Metafields per prodotto**: ~15  
**Tempo sync stimato**: 1.5s per prodotto  
**Status**: ✅ Implementato e testato
