# Flusso di Lavoro Automatico

Questo documento descrive in dettaglio come funziona il processo automatico di gestione listini.

## 📊 Overview del Processo

```
┌─────────────────────────────────────────────────────────────────┐
│                    ESECUZIONE AUTOMATICA                         │
│                    (Giornaliera - 02:00 AM)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. INGESTIONE LISTINI                                           │
│    • Download listini da tutti i fornitori attivi               │
│    • Parsing file (CSV, Excel, XML, JSON)                       │
│    • Salvataggio in tabella listini_raw                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. NORMALIZZAZIONE DATI                                         │
│    • Applicazione mappature campi                               │
│    • Applicazione mappature categorie                           │
│    • Trasformazioni dati (trim, uppercase, normalize_ean)       │
│    • Validazione dati                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. CONSOLIDAMENTO MASTER FILE                                   │
│    • Raggruppamento per EAN/GTIN                                │
│    • Selezione miglior fornitore (prezzo più basso)             │
│    • Aggregazione quantità disponibili                          │
│    • Creazione/aggiornamento master_file                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. ARRICCHIMENTO DATI                                           │
│    • Download dati ICecat (descrizioni, immagini, specifiche)   │
│    • Generazione descrizioni AI (GPT-4/Claude/Gemini)           │
│    • Salvataggio in tabella dati_icecat                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. CALCOLO PREZZI                                               │
│    • Applicazione regole markup (priorità: prodotto > marca >   │
│      categoria > default)                                       │
│    • Calcolo prezzo vendita finale                              │
│    • Aggiunta costi spedizione                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. GENERAZIONE OUTPUT SHOPIFY                                   │
│    • Formattazione dati per Shopify                             │
│    • Creazione handle, title, body_html                         │
│    • Generazione tag automatici                                 │
│    • Salvataggio in tabella output_shopify                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. EXPORT SHOPIFY                                               │
│    • Upload via API Shopify (se configurato)                    │
│    • Oppure generazione CSV per import manuale                  │
│    • Aggiornamento stato_caricamento                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. NOTIFICHE E LOG                                              │
│    • Salvataggio log in log_elaborazioni                        │
│    • Invio email con report                                     │
│    • Notifica Slack/Telegram (se configurato)                   │
└─────────────────────────────────────────────────────────────────┘
```

## 🔍 Dettaglio Fasi

### 1. Ingestione Listini

**Obiettivo**: Scaricare i listini da tutti i fornitori attivi.

**Processo**:
1. Query database per ottenere fornitori con `attivo = true`
2. Per ogni fornitore:
   - Connessione al listino (HTTP, FTP, API)
   - Download file
   - Parsing basato su `formatoFile`:
     - **CSV**: usa `csv-parser` con encoding e separatore configurati
     - **Excel**: usa `xlsx` library
     - **XML**: usa `xml2js`
     - **JSON**: parsing nativo
3. Salvataggio record in `listini_raw` con timestamp
4. Aggiornamento `ultimaSincronizzazione` del fornitore

**Gestione Errori**:
- Timeout connessione: 30 secondi
- Retry: 3 tentativi con backoff esponenziale
- Log errore ma continua con altri fornitori

**Output**:
- Record in `listini_raw`
- Log in `log_elaborazioni` (fase: "ingestione")

---

### 2. Normalizzazione Dati

**Obiettivo**: Trasformare i dati grezzi in formato standard.

**Processo**:
1. Per ogni record in `listini_raw` (importato oggi):
   - Recupera mappature campi del fornitore
   - Applica trasformazioni:
     - `trim`: rimuove spazi
     - `uppercase`: maiuscolo
     - `lowercase`: minuscolo
     - `normalize_ean`: aggiunge zeri iniziali per EAN-13
   - Recupera mappature categorie
   - Sostituisce categoria fornitore con categoria e-commerce
2. Validazione dati:
   - EAN/GTIN valido (13 cifre)
   - Prezzo > 0
   - Quantità >= 0

**Gestione Errori**:
- Record invalidi: marcati ma non bloccano il processo
- Log warning per record scartati

**Output**:
- Dati normalizzati pronti per consolidamento
- Log warning per record problematici

---

### 3. Consolidamento Master File

**Obiettivo**: Creare catalogo unico con miglior prezzo per prodotto.

**Processo**:
1. Raggruppa prodotti per `eanGtin`
2. Per ogni gruppo:
   - Seleziona fornitore con prezzo più basso
   - Somma quantità disponibili da tutti i fornitori
   - Crea/aggiorna record in `master_file`:
     ```sql
     INSERT INTO master_file (
       ean_gtin,
       sku_selezionato,
       fornitore_selezionato_id,
       prezzo_acquisto_migliore,
       quantita_totale_aggregata,
       categoria_ecommerce,
       marca
     ) VALUES (...)
     ON CONFLICT (ean_gtin) DO UPDATE ...
     ```

**Logica Selezione Fornitore**:
1. Prezzo più basso
2. Se parità: fornitore con più stock
3. Se ancora parità: fornitore con sync più recente

**Output**:
- Record aggiornati in `master_file`
- Statistiche: prodotti nuovi, aggiornati, invariati

---

### 4. Arricchimento Dati

**Obiettivo**: Aggiungere descrizioni, immagini e specifiche tecniche.

**Processo ICecat**:
1. Per ogni prodotto in `master_file` senza dati ICecat:
   - Chiamata API ICecat con EAN/GTIN
   - Parsing risposta XML/JSON
   - Estrazione:
     - Descrizione breve
     - Descrizione lunga
     - Specifiche tecniche (JSON)
     - URL immagini (array JSON)
   - Salvataggio in `dati_icecat`
2. Rate limiting: max 100 req/min (ICecat free tier)

**Processo AI**:
1. Per prodotti con dati ICecat:
   - Costruzione prompt con:
     - Descrizione ICecat
     - Specifiche tecniche
     - Template personalizzato
   - Chiamata API AI (OpenAI/Claude/Gemini)
   - Salvataggio descrizione generata
2. Batch processing: 10 prodotti alla volta
3. Cost tracking: log costo stimato

**Gestione Errori**:
- Prodotto non trovato su ICecat: usa solo dati fornitore
- Errore API AI: usa descrizione ICecat originale
- Rate limit: pausa e retry

**Output**:
- Record in `dati_icecat`
- Descrizioni AI ottimizzate SEO

---

### 5. Calcolo Prezzi

**Obiettivo**: Applicare markup e calcolare prezzo vendita.

**Processo**:
1. Per ogni prodotto in `master_file`:
   - Cerca regola markup con priorità:
     1. `tipoRegola = 'prodotto_specifico'` AND `riferimento = SKU`
     2. `tipoRegola = 'marca'` AND `riferimento = marca`
     3. `tipoRegola = 'categoria'` AND `riferimento = categoria`
     4. `tipoRegola = 'default'`
   - Applica prima regola trovata:
     ```
     prezzo_vendita = (prezzo_acquisto * (1 + markup_percentuale/100)) + markup_fisso + costo_spedizione
     ```
   - Arrotondamento: 2 decimali
   - Aggiorna `prezzoVenditaCalcolato` in `master_file`

**Validazione Date**:
- Verifica `dataInizioValidita` <= oggi <= `dataFineValidita`
- Salta regole scadute

**Output**:
- Prezzi vendita calcolati in `master_file`

---

### 6. Generazione Output Shopify

**Obiettivo**: Formattare dati per Shopify.

**Processo**:
1. Per ogni prodotto in `master_file`:
   - Genera `handle`: slug da nome prodotto
   - Genera `title`: `{marca} - {nome} - {caratteristica}`
   - Genera `body_html`: descrizione AI in HTML
   - Imposta `vendor`: marca
   - Imposta `product_type`: categoria
   - Genera `tags`: marca, categoria, caratteristiche
   - Imposta `variant_price`: prezzo vendita
   - Imposta `variant_inventory_qty`: quantità
   - Imposta `immagini_urls`: array URL da ICecat
2. Salva in `output_shopify` con `stato_caricamento = 'pending'`

**Template Title**:
```
{marca} - {nome_prodotto} - {caratteristica_principale}
```

**Tag Automatici**:
- Marca
- Categoria principale
- "Disponibile" se stock > 0
- "Novità" se creato oggi
- Caratteristiche estratte (es. "Wireless", "Gaming", "4K")

**Output**:
- Record in `output_shopify`

---

### 7. Export Shopify

**Obiettivo**: Caricare prodotti su Shopify.

**Metodo A: API Upload** (se configurato):
1. Per ogni record in `output_shopify` con `stato = 'pending'`:
   - Chiamata API Shopify:
     ```
     POST /admin/api/2024-01/products.json
     ```
   - Se successo:
     - Salva `shopifyProductId`
     - Aggiorna `stato_caricamento = 'uploaded'`
   - Se errore:
     - Aggiorna `stato_caricamento = 'error'`
     - Salva `errorMessage`
2. Rate limiting: max 2 req/sec (Shopify limit)
3. Batch: 250 prodotti per esecuzione

**Metodo B: CSV Export**:
1. Genera CSV con formato Shopify:
   ```csv
   Handle,Title,Body (HTML),Vendor,Type,Tags,Variant Price,Variant Inventory Qty,Image Src
   ```
2. Salva in `./exports/shopify_YYYYMMDD_HHMMSS.csv`
3. Aggiorna `stato_caricamento = 'exported'`

**Output**:
- Prodotti caricati su Shopify
- Oppure file CSV in `./exports/`

---

### 8. Notifiche e Log

**Obiettivo**: Informare amministratori e tracciare esecuzione.

**Log Database**:
Per ogni fase, salva in `log_elaborazioni`:
```json
{
  "dataEsecuzione": "2024-01-15T02:00:00Z",
  "faseProcesso": "ingestione",
  "stato": "success",
  "dettagliJson": {
    "fornitoriProcessati": 5,
    "prodottiImportati": 1500,
    "errori": []
  },
  "durataSecondi": 45,
  "prodottiProcessati": 1500,
  "prodottiErrore": 0
}
```

**Email Report**:
Template email con:
- ✅ Riepilogo esecuzione
- 📊 Statistiche: prodotti importati, aggiornati, errori
- ⏱️ Durata totale
- ⚠️ Warning ed errori (se presenti)
- 🔗 Link alla dashboard

**Notifica Slack/Telegram**:
Messaggio breve:
```
✅ Esecuzione completata
📦 1500 prodotti importati
⏱️ Durata: 5m 30s
🔗 Vedi dettagli
```

**Output**:
- Email inviata
- Notifica Slack/Telegram
- Log completi in database

---

## ⚙️ Configurazione Scheduler

### Cron Expression

Default: `0 2 * * *` (ogni giorno alle 2:00 AM)

Altri esempi:
- `0 */12 * * *`: ogni 12 ore
- `0 2,14 * * *`: alle 2:00 e 14:00
- `0 2 * * 1-5`: alle 2:00 solo lun-ven

### Variabili Ambiente

```env
CRON_EXPRESSION=0 2 * * *
AUTO_RUN_ENABLED=true
```

### Esecuzione Manuale

Dalla dashboard:
1. Vai su **Scheduler**
2. Clicca **Esegui Ora**
3. Monitora in tempo reale

Via API:
```bash
curl -X POST http://localhost:3000/api/scheduler/run \
  -H "Authorization: Bearer <token>"
```

---

## 📈 Monitoraggio

### Metriche Chiave

- **Durata totale**: tempo esecuzione completa
- **Prodotti processati**: totale prodotti elaborati
- **Tasso errore**: % prodotti con errori
- **Costo AI**: costo stimato chiamate AI
- **Rate limit**: utilizzo limiti API (ICecat, Shopify, AI)

### Alert

Configurabili in **Scheduler** → **Notifiche**:
- ⚠️ Durata > 30 minuti
- ⚠️ Errori > 5%
- ⚠️ Nessun prodotto importato
- ❌ Esecuzione fallita

---

## 🔧 Troubleshooting

### Esecuzione Bloccata

1. Controlla log in `backend/logs/error.log`
2. Verifica stato in `log_elaborazioni`
3. Controlla connessioni database/Redis
4. Riavvia processo manualmente

### Prodotti Non Importati

1. Verifica connessione fornitore (Test Connection)
2. Controlla mappature campi
3. Verifica formato file
4. Controlla log fase "ingestione"

### Prezzi Errati

1. Verifica regole markup
2. Controlla priorità regole
3. Verifica date validità
4. Controlla log fase "calcolo_prezzi"

### Upload Shopify Fallito

1. Verifica credenziali API
2. Controlla rate limit Shopify
3. Verifica formato dati
4. Controlla `errorMessage` in `output_shopify`

---

## 🎯 Best Practices

1. **Test Prima di Produzione**: esegui manualmente e verifica risultati
2. **Backup Database**: prima di ogni esecuzione automatica
3. **Monitora Log**: controlla giornalmente per errori
4. **Ottimizza Mappature**: aggiorna mappature categorie regolarmente
5. **Rivedi Pricing**: verifica regole markup periodicamente
6. **Limita Batch**: non processare troppi prodotti alla volta (max 5000)
7. **Cache ICecat**: evita chiamate duplicate per stesso EAN
8. **Cost Control**: monitora costi API AI

---

## 📚 Risorse

- [Prisma Docs](https://www.prisma.io/docs)
- [ICecat API](https://icecat.biz/en/menu/partners/index.html)
- [Shopify API](https://shopify.dev/api/admin-rest)
- [OpenAI API](https://platform.openai.com/docs)
- [Node-Cron](https://github.com/node-cron/node-cron)
