# 🔍 Report Analisi: Problema Importazione Notebook Asus

## 📊 Situazione Trovata

### Database Status
- **ListinoRaw**: 10,707 prodotti importati
- **MasterFile**: 498 prodotti (prima della correzione)
- **Prodotti Asus trovati**: 339 prodotti totali
  - **Notebook Asus**: 96 prodotti
  - **Con prezzo valido**: 84 notebook
  - **Con prezzo = 0**: 12 notebook

## 🐛 Problemi Identificati

### 1. **Marche Errate nei Notebook Asus**
I notebook Asus avevano codici marca sbagliati nel `ListinoRaw`:
- `NBAEDUB` → dovrebbe essere `ASUS`
- `NBASB` → dovrebbe essere `ASUS`
- `NBALB` → dovrebbe essere `ASUS`
- Molti con marca `null` ma "ASUS" nella descrizione

**Causa**: Il file del fornitore usa codici interni invece del nome marca standard.

### 2. **Regola di Filtro Sbagliata**
La regola di filtro cercava:
- Brand: `ASUSTEK`
- Categoria: `NOTEBOOK`
- Tipo: `brand_category` (richiede match su entrambi)

Ma i notebook avevano:
- Brand: `NBAEDUB`, `NBASB`, `NBALB` (non `ASUSTEK`)
- Categoria: `null` o `O` (non `NOTEBOOK`)

**Risultato**: Nessun notebook passava il filtro!

### 3. **Prezzi a Zero**
12 notebook Asus hanno `prezzoAcquisto = 0`, quindi vengono esclusi dal consolidamento.

**Causa**: Problema nel parsing del file del fornitore o prodotti senza prezzo nel listino.

## ✅ Correzioni Applicate

### 1. Correzione Marche
```sql
-- Aggiornati 101 prodotti
UPDATE listini_raw 
SET marca = 'ASUS' 
WHERE marca IN ('NBAEDUB', 'NBASB', 'NBALB', 'NBASUS')
   OR (marca IS NULL AND descrizioneOriginale LIKE '%ASUS%')
```

### 2. Aggiornamento Regole di Filtro
Creata nuova regola:
- **Nome**: "Notebook Asus"
- **Tipo**: `brand` (solo marca, non categoria)
- **Brand**: `ASUS`
- **Azione**: `include`
- **Priorità**: 1

Aggiunta anche regola per `ASUSTEK` (server e barebone).

## 📋 Prossimi Passi

### Immediati
1. **Rilanciare il consolidamento** del MasterFile
2. **Applicare il markup** per calcolare i prezzi di vendita
3. **Preparare l'export** per Shopify

### Da Verificare
1. **Problema prezzi a zero**: Controllare la configurazione di parsing per il fornitore "Brevi"
   - File: Mappature campi fornitore
   - Verificare che il campo prezzo sia mappato correttamente

2. **Categorie mancanti**: I notebook hanno categoria `null` o `O`
   - Creare mappature categoria per normalizzare

## 🎯 Risultato Atteso

Dopo il consolidamento dovresti avere:
- **~84 notebook Asus** nel MasterFile (quelli con prezzo valido)
- Pronti per essere arricchiti con Icecat
- Pronti per l'export su Shopify

## 🛠️ Comandi per Completare

```bash
# 1. Consolidamento (via API o script)
cd backend
npx ts-node -e "import {MasterFileService} from './src/services/MasterFileService'; MasterFileService.consolidaMasterFile().then(r => console.log(r))"

# 2. Applicazione markup
npx ts-node -e "import {MarkupService} from './src/services/MarkupService'; MarkupService.applicaRegolePrezzi().then(r => console.log(r))"

# 3. Verifica risultati
npx ts-node src/scripts/check_asus_brands.ts
```

## 📝 Note Tecniche

### File Modificati
- `listini_raw` table: 101 record aggiornati
- `product_filter_rules` table: 2 nuove regole create

### Script Creati
1. `debug_asus_filter.ts` - Debug filtri
2. `check_asus_brands.ts` - Verifica marche
3. `check_raw_data.ts` - Analisi dati raw
4. `test_asus_consolidation.ts` - Test consolidamento
5. `fix_asus_brands.ts` - Correzione marche ✅
6. `setup_asus_filters.ts` - Setup filtri ✅
7. `run_consolidation.ts` - Consolidamento completo

### Problemi Noti
- **Database connections**: Il consolidamento crea troppe connessioni Prisma
  - Soluzione: Usare l'API REST invece dello script diretto
  - Oppure: Ottimizzare il codice per riusare la connessione

---

**Data analisi**: 2025-11-29  
**Prodotti Asus trovati**: 96 notebook, 325 totali  
**Correzioni applicate**: ✅ Marche, ✅ Filtri  
**Da completare**: Consolidamento, Markup, Export
