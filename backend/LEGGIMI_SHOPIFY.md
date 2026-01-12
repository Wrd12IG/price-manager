# 🛍️ Export Prodotti Shopify

Hai generato con successo l'export dei prodotti per Shopify arricchito con i dati Icecat.

## 📂 File Generati

### 1. Anteprima Visuale (`shopify_export.html`)
Apri questo file nel browser per vedere una tabella formattata con tutti i dati.
- **Percorso:** `./shopify_export.html`

### 2. File di Importazione (`shopify_export.csv`)
Usa questo file per importare i prodotti nel tuo store Shopify o per modificarli in Excel.
- **Percorso:** `./shopify_export.csv`

### 3. Dati JSON (`shopify_export.json`)
File dati strutturato per uso programmatico.
- **Percorso:** `./shopify_export.json`

## 📋 Campi Inclusi

Il file CSV include le seguenti colonne mappate dai dati Icecat:

### Dati Prodotto
- **EAN**: Codice a barre univoco
- **Nome**: Titolo del prodotto
- **Marca**: Brand del prodotto (es. ASUS)

### Specifiche Display
- **Famiglia**: Categoria (es. Notebook)
- **Tipologia Display**: LCD, LED, OLED, ecc.
- **Touch Screen**: Sì/No
- **Rapporto Aspetto**: es. 16:9
- **Risoluzione Monitor**: HD, Full HD, 4K, ecc.
- **Dimensione Monitor**: es. 15" - 15,6 pollici
- **Dimensione Schermo**: es. Full HD (FHD): 1920 × 1080 px

### Specifiche Tecniche
- **Tipo PC**: Notebook, Desktop, All-in-One
- **Capacità SSD**: es. 512GB
- **Scheda Video**: Modello GPU
- **Sistema Operativo**: es. Windows 11 Pro
- **RAM**: es. 16GB
- **Processore Brand**: Intel, AMD, ecc.

### Contenuti Marketing
- **Descrizione Breve**: Sommario per le card prodotto
- **Descrizione Lunga**: Descrizione completa HTML
- **Testo Personalizzato**: Frase marketing generata (es. "Scopri il Notebook ASUS con prestazioni eccezionali!")
- **Tabella Specifiche**: Tabella HTML pronta per la pagina prodotto
- **Scheda PDF**: Link al manuale o scheda tecnica PDF
