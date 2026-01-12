# 📊 Mappatura Export Shopify

## 🎯 Problema Critico: ID Unico Mancante

**Attualmente l'app usa l'EAN come `Handle` di Shopify.** Questo causa duplicazione prodotti perché:
- Se il prodotto viene modificato, Shopify non lo riconosce come esistente
- Prodotti diversi potrebbero avere lo stesso EAN (raro ma possibile)

### ✅ Soluzione Proposta
Usare il campo `masterFileId` come identificatore univoco nel formato:
```
PRD-{masterFileId}-{timestamp}
```
O più semplicemente usare `EAN` + validazione duplicati prima del caricamento.

---

## 📋 MENU: Campi Esportati

### 🟢 Campi Base Shopify (TUTTI ESPORTATI)

| Campo CSV Shopify | Valore App | Stato |
|-------------------|------------|-------|
| `Handle` | EAN | ✅ |
| `Title` | Nome ottimizzato SEO | ✅ |
| `Body (HTML)` | Descrizione lunga HTML | ✅ |
| `Vendor` | Marca | ✅ |
| `Type` | Famiglia/Categoria | ✅ |
| `Tags` | Tipo PC, Marca, Categoria | ✅ |
| `Published` | TRUE | ✅ |
| `Option1 Name` | Title | ✅ |
| `Option1 Value` | Default Title | ✅ |
| `Variant SKU` | EAN | ✅ |
| `Variant Grams` | 1000 | ✅ |
| `Variant Inventory Qty` | Quantità | ✅ |
| `Variant Price` | Prezzo | ✅ |
| `Image Src` | Prima immagine Icecat | ✅ |

---

### 🟡 Metafield PARZIALMENTE Esportati

| Tuo Metafield | Nome Attuale CSV | Campo App | Stato |
|---------------|------------------|-----------|-------|
| `Tipo PC` | `custom.tipo_pc` | tipoPC | ✅ |
| `Ram` | `custom.ram` | ram | ✅ |
| `Scheda Video` | `custom.scheda_video` | schedaVideo | ✅ |
| `Scheda PDF` | `custom.pdf_scheda` | schedaPDF | ✅ |
| `Risoluzione Monitor` | `custom.risoluzione` | risoluzione Monitor | ⚠️ Nome diverso |
| `Capacità SSD` | `custom.ssd` | capacitaSSD | ⚠️ Nome diverso |
| `Sistema Operativo` | `custom.os` | sistemaOperativo | ⚠️ Nome diverso |
| `Processore Brand` | `custom.processore` | processoreBrand | ⚠️ Nome diverso |

---

### 🔴 Metafield NON Esportati (Da Aggiungere!)

| Tuo Metafield Shopify | Tipo | Campo App Disponibile | Azione |
|-----------------------|------|----------------------|--------|
| `Famiglia` | Testo singolo | famiglia | ➕ Aggiungere |
| `Tipologia Display` | Testo singolo | tipologiaDisplay | ➕ Aggiungere |
| `Touch Screen` | Testo singolo | touchScreen | ➕ Aggiungere |
| `Marca` | Testo singolo | marca | ➕ Aggiungere |
| `Rapporto Aspetto` | Testo singolo | rapportoAspetto | ➕ Aggiungere |
| `Dimensione Monitor` | Testo singolo | dimensioneMonitor | ➕ Aggiungere |
| `Dimensione Schermo` | Testo singolo | dimensioneSchermo | ➕ Aggiungere |
| `Tabelle Specifiche` | Multilinea | tabellaSpecifiche | ➕ Aggiungere |
| `EAN` | Multilinea | ean | ➕ Aggiungere |
| `Testo Personalizzato` | Testo singolo | testoPersonalizzato | ➕ Aggiungere |
| `Descrizione Breve` | Multilinea | descrizioneBrave | ➕ Aggiungere |
| `Descrizione Lunga` | Multilinea | (già in Body HTML) | ⚠️ Valutare |

---

## ✅ MODIFICHE COMPLETATE

### 1. ✅ ID Univoco Aggiunto
```typescript
// Handle univoco: PRD-{masterFileId}-{ean}
const uniqueHandle = `prd-${masterFileId}-${p.ean}`;
```
Ora ogni prodotto ha un Handle univoco che include l'ID del database, evitando duplicati su Shopify.

### 2. ✅ Tutti i Metafield Aggiunti al CSV (20 totali)

**Display (7):**
- `custom.famiglia`
- `custom.tipologia_display`
- `custom.touch_screen`
- `custom.rapporto_aspetto`
- `custom.risoluzione_monitor`
- `custom.dimensione_monitor`
- `custom.dimensione_schermo`

**Hardware (6):**
- `custom.tipo_pc`
- `custom.capacita_ssd`
- `custom.scheda_video`
- `custom.sistema_operativo`
- `custom.ram`
- `custom.processore_brand`

**Contenuti (6):**
- `custom.tabelle_specifiche` (multi_line)
- `custom.ean` (multi_line)
- `custom.testo_personalizzato`
- `custom.descrizione_breve` (multi_line)
- `custom.descrizione_lunga` (multi_line)
- `custom.marca`

**File (1):**
- `custom.scheda_pdf` (url)

### 3. ✅ Nomi Metafield Corretti e Allineati

| Nome Vecchio | Nome Nuovo (Corretto) |
|--------------|----------------------|
| `custom.risoluzione` | `custom.risoluzione_monitor` |
| `custom.ssd` | `custom.capacita_ssd` |
| `custom.os` | `custom.sistema_operativo` |
| `custom.processore` | `custom.processore_brand` |
| `custom.display` | `custom.tipologia_display` |
| `custom.pdf_scheda` | `custom.scheda_pdf` |

---

## 📊 Riepilogo Finale

| Categoria | Prima | Dopo |
|-----------|-------|------|
| Campi Base CSV | 14 ✅ | 14 ✅ |
| Metafield CSV | 9 | **20** ✅ |
| ID Univoco | ❌ | ✅ |
| Nomi Allineati | ❌ | ✅ |

**File modificato:** `backend/src/services/ShopifyService.ts`
