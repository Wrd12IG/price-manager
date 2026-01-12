# Arricchimento Prodotti con AI e Web Scraping

## Panoramica

Abbiamo implementato un sistema completo per arricchire i prodotti del Master File utilizzando due approcci:

1. **Icecat API** - Per prodotti con EAN validi trovati nel database Icecat
2. **Web Scraping + AI** - Per prodotti non trovati su Icecat, cercandoli sui siti web esterni

## Nuove Funzionalità

### 1. Web Scraping Enrichment Service

**File**: `src/services/WebScrapingEnrichmentService.ts`

Questo servizio:
- Cerca prodotti sui siti web esterni (AsusStore, AsusWorld, NextHS)
- Scarica la pagina HTML del prodotto
- Utilizza Google Gemini AI per estrarre informazioni strutturate dall'HTML
- Salva i dati nella tabella `DatiIcecat` come se provenissero da Icecat

**Funzionalità principali**:
- `searchProductOnWeb()` - Cerca un prodotto su più siti web
- `extractDataWithAI()` - Estrae dati strutturati dall'HTML usando AI
- `enrichSingleProduct()` - Arricchisce un singolo prodotto
- `enrichMissingProducts()` - Arricchisce fino a N prodotti mancanti
- `getEnrichmentStats()` - Statistiche sull'arricchimento

### 2. Script di Arricchimento

**File**: `run_web_scraping_enrichment.ts`

Script eseguibile per arricchire i prodotti mancanti:

```bash
npx tsx run_web_scraping_enrichment.ts
```

Lo script:
- Trova tutti i prodotti senza dati Icecat
- Processa fino a 50 prodotti alla volta
- Mostra statistiche prima e dopo l'arricchimento
- Include pause tra le richieste per evitare rate limiting

### 3. Export Migliorato

**File**: `enrich_and_export_masterfile.ts`

Abbiamo aggiornato lo script di esportazione per includere **TUTTE** le colonne Icecat disponibili:

#### Nuove Colonne Aggiunte:

**Metadati Icecat**:
- `Icecat ID` - ID del record Icecat
- `Icecat Master File ID` - ID del prodotto nel Master File
- `Icecat EAN` - EAN del prodotto
- `Icecat Created At` - Data creazione record
- `Icecat Updated At` - Data ultimo aggiornamento

**Conteggi Analitici**:
- `Numero Immagini` - Quante immagini sono disponibili
- `Numero Bullet Points` - Quanti bullet points sono disponibili
- `Numero Documenti` - Quanti documenti (PDF, manuali) sono disponibili
- `Numero Specifiche` - Quante specifiche tecniche sono disponibili

Questi conteggi permettono di:
- Identificare rapidamente prodotti con dati incompleti
- Filtrare prodotti per qualità dell'arricchimento
- Analizzare la copertura dei dati

## Come Usare

### Passo 1: Arricchimento con Icecat API

```bash
# Prima arricchisci con Icecat (se hai le credenziali configurate)
npx tsx enrich_and_export_masterfile.ts
```

Questo script:
1. Arricchisce tutti i prodotti usando Icecat API
2. Genera file CSV, JSON e HTML con tutti i dati

### Passo 2: Arricchimento con Web Scraping

```bash
# Poi arricchisci i prodotti mancanti con web scraping
npx tsx run_web_scraping_enrichment.ts
```

Questo script:
1. Trova prodotti senza dati Icecat
2. Li cerca sui siti web esterni
3. Estrae dati usando AI
4. Salva i dati nel database

### Passo 3: Esportazione Finale

```bash
# Infine, esporta tutti i dati arricchiti
npx tsx enrich_and_export_masterfile.ts
```

Questo genera:
- `masterfile_enriched.csv` - Tabella CSV con tutte le colonne
- `masterfile_enriched.json` - Dati completi in JSON
- `masterfile_enriched.html` - Report HTML interattivo

## Siti Web Supportati

Il sistema cerca prodotti su:

1. **AsusStore** (https://www.asustore.it)
   - Rivenditore autorizzato ASUS
   - Prodotti ASUS ufficiali

2. **AsusWorld** (https://www.asusworld.it)
   - Portale ufficiale ASUS Italia
   - Informazioni tecniche dettagliate

3. **NextHS** (https://www.nexths.it)
   - Rivenditore hardware e software
   - Ampia gamma di prodotti tech

## Dati Estratti con AI

Per ogni prodotto trovato, l'AI estrae:

### Descrizioni
- **Descrizione Breve** (max 160 caratteri)
- **Descrizione Lunga** (2-3 paragrafi dettagliati)

### Specifiche Tecniche
- Processore
- RAM
- Storage
- Display
- Scheda Grafica
- Sistema Operativo
- Dimensioni
- Peso
- Batteria
- Connettività
- Porte

### Bullet Points
- 5 punti chiave del prodotto
- Caratteristiche principali
- Vantaggi competitivi

### Immagini
- URL delle immagini del prodotto
- Immagini ad alta risoluzione quando disponibili

### Caratteristiche Principali
- Tipo PC (Notebook/Desktop/All-in-One)
- Rapporto Aspetto (16:9/16:10)
- Risoluzione Monitor
- Dimensione Schermo
- Tipo Processore (Intel/AMD)
- Serie Processore
- Tipo Storage (SSD/HDD)
- Capacità Storage

## Formato CSV Completo

Il file CSV esportato include **36 colonne**:

### Master File (11 colonne)
1. ID
2. EAN/GTIN
3. SKU
4. Nome Prodotto
5. Prezzo Acquisto
6. Prezzo Vendita
7. Quantità
8. Fornitore
9. Marchio
10. Categoria
11. Data Aggiornamento

### Icecat - Stato (4 colonne)
12. Icecat Arricchito
13. Icecat ID
14. Icecat Master File ID
15. Icecat EAN

### Icecat - Descrizioni (2 colonne)
16. Icecat Descrizione Breve
17. Icecat Descrizione Lunga

### Icecat - Dati JSON (4 colonne)
18. Icecat Specifiche Tecniche (JSON)
19. Icecat Immagini (JSON)
20. Icecat Bullet Points (JSON)
21. Icecat Documenti (JSON)

### Icecat - Metadati (4 colonne)
22. Icecat Lingua
23. Icecat Data Scaricamento
24. Icecat Created At
25. Icecat Updated At

### Icecat - Conteggi (4 colonne)
26. Numero Immagini
27. Numero Bullet Points
28. Numero Documenti
29. Numero Specifiche

## Vantaggi

### Copertura Completa
- Combina dati da Icecat API e web scraping
- Massimizza il numero di prodotti arricchiti
- Riduce i prodotti senza descrizioni/immagini

### Dati Strutturati
- Tutte le informazioni in formato JSON
- Facile da importare in altri sistemi
- Compatibile con Shopify e altri e-commerce

### Analisi Rapida
- Conteggi immediati per valutare la qualità
- Identificazione prodotti con dati incompleti
- Statistiche di copertura

### Flessibilità
- Processa batch di prodotti
- Pause configurabili tra richieste
- Gestione errori robusta

## Limitazioni e Note

### Rate Limiting
- Il sistema include pause di 2 secondi tra richieste
- Processa max 50 prodotti per esecuzione
- Eseguire più volte per arricchire tutti i prodotti

### Qualità Dati AI
- L'AI estrae dati dall'HTML disponibile
- La qualità dipende dalla struttura del sito web
- Alcuni campi potrebbero essere vuoti se non trovati

### Siti Web Supportati
- Attualmente solo 3 siti configurati
- Possibile aggiungere altri siti modificando `searchSites`
- Richiede selettori CSS specifici per ogni sito

## Prossimi Passi

1. **Eseguire l'arricchimento completo**:
   ```bash
   npx tsx run_web_scraping_enrichment.ts
   ```

2. **Verificare i risultati**:
   ```bash
   npx tsx enrich_and_export_masterfile.ts
   ```

3. **Analizzare il CSV**:
   - Aprire `masterfile_enriched.csv` in Excel/Google Sheets
   - Filtrare per `Icecat Arricchito = Sì`
   - Controllare i conteggi (Numero Immagini, Bullet Points, ecc.)

4. **Iterare se necessario**:
   - Se ci sono ancora prodotti mancanti, eseguire di nuovo lo script
   - Aggiungere altri siti web se necessario
   - Migliorare i selettori CSS per estrazioni più accurate

## Supporto

Per problemi o domande:
- Controllare i log durante l'esecuzione
- Verificare che `GOOGLE_AI_API_KEY` sia configurata
- Assicurarsi che i siti web siano accessibili
