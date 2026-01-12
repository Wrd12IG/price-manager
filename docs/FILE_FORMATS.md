# Formati File Supportati

Il sistema supporta l'importazione di listini prezzi in diversi formati.

## 📄 Formati Supportati

### 1. CSV (Comma-Separated Values)
- **Estensione**: `.csv`
- **Separatore predefinito**: `;` (punto e virgola)
- **Separatore personalizzabile**: Sì, configurabile per fornitore
- **Encoding**: UTF-8 (configurabile)

**Esempio**:
```csv
Codice;Descrizione;Prezzo;Quantità
SKU001;Prodotto A;19.99;100
SKU002;Prodotto B;29.99;50
```

### 2. TSV (Tab-Separated Values)
- **Estensione**: `.tsv`
- **Separatore**: Tab (`\t`)
- **Encoding**: UTF-8 (configurabile)

**Esempio**:
```tsv
Codice	Descrizione	Prezzo	Quantità
SKU001	Prodotto A	19.99	100
SKU002	Prodotto B	29.99	50
```

### 3. TXT (Text File)
- **Estensione**: `.txt`
- **Separatore**: Tab (`\t`) - stesso formato di TSV
- **Encoding**: UTF-8 (configurabile)
- **Note**: Utile per file esportati da sistemi legacy

### 4. Excel
- **Estensioni**: `.xlsx`, `.xls`
- **Foglio**: Viene letto il primo foglio del workbook
- **Intestazioni**: Prima riga viene usata come header

**Esempio**:
| Codice | Descrizione | Prezzo | Quantità |
|--------|-------------|--------|----------|
| SKU001 | Prodotto A  | 19.99  | 100      |
| SKU002 | Prodotto B  | 29.99  | 50       |

### 5. XML
- **Estensione**: `.xml`
- **Struttura**: Il parser cerca automaticamente l'array di prodotti
- **Encoding**: UTF-8 (configurabile)

**Esempio**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Catalogo>
  <Prodotto>
    <Codice>SKU001</Codice>
    <Descrizione>Prodotto A</Descrizione>
    <Prezzo>19.99</Prezzo>
    <Quantita>100</Quantita>
  </Prodotto>
  <Prodotto>
    <Codice>SKU002</Codice>
    <Descrizione>Prodotto B</Descrizione>
    <Prezzo>29.99</Prezzo>
    <Quantita>50</Quantita>
  </Prodotto>
</Catalogo>
```

### 6. JSON
- **Estensione**: `.json`
- **Struttura**: Array di oggetti o oggetto con proprietà array
- **Encoding**: UTF-8

**Esempio 1 - Array diretto**:
```json
[
  {
    "Codice": "SKU001",
    "Descrizione": "Prodotto A",
    "Prezzo": 19.99,
    "Quantita": 100
  },
  {
    "Codice": "SKU002",
    "Descrizione": "Prodotto B",
    "Prezzo": 29.99,
    "Quantita": 50
  }
]
```

**Esempio 2 - Oggetto con array**:
```json
{
  "prodotti": [
    {
      "Codice": "SKU001",
      "Descrizione": "Prodotto A",
      "Prezzo": 19.99,
      "Quantita": 100
    }
  ]
}
```

## ⚙️ Configurazione per Fornitore

Per ogni fornitore puoi configurare:

1. **Formato File**: Seleziona il formato del listino
2. **Encoding**: UTF-8, ISO-8859-1, Windows-1252, ecc.
3. **Separatore CSV**: `;`, `,`, `|`, tab, ecc.
4. **URL Listino**: Dove scaricare il file
5. **Tipo Accesso**: Direct URL, HTTP Auth, FTP, API

## 🔄 Processo di Importazione

1. **Download**: Il sistema scarica il file dall'URL configurato
2. **Parsing**: Il file viene parsato secondo il formato specificato
3. **Validazione**: Verifica che le colonne necessarie siano presenti
4. **Mappatura**: Applica la mappatura campi configurata
5. **Salvataggio**: I dati vengono salvati nella tabella `ListinoRaw`

## 📝 Best Practices

### CSV/TSV/TXT
- Usa sempre la prima riga come intestazione
- Evita caratteri speciali nei nomi delle colonne
- Usa encoding UTF-8 per supportare caratteri accentati
- Se usi virgole nei valori, racchiudi il campo tra virgolette

### Excel
- Mantieni i dati nel primo foglio
- Usa formattazione semplice (evita celle unite)
- Prima riga deve contenere i nomi delle colonne
- Evita formule complesse

### XML
- Usa una struttura consistente per tutti i prodotti
- Evita attributi, preferisci elementi
- Mantieni i nomi dei tag in inglese o senza spazi

### JSON
- Usa array di oggetti per massima compatibilità
- Mantieni la struttura piatta (evita nesting profondo)
- Usa nomi di proprietà consistenti

## 🐛 Troubleshooting

### Errore: "Formato file non supportato"
- Verifica che l'estensione del file corrisponda al formato configurato
- Controlla che il file non sia corrotto

### Errore: "Nessuna colonna trovata"
- Assicurati che la prima riga contenga le intestazioni
- Verifica il separatore configurato per CSV/TSV

### Errore: "Encoding non valido"
- Prova a cambiare l'encoding in UTF-8
- Alcuni file Windows usano Windows-1252 o ISO-8859-1

### Prodotti mancanti dopo importazione
- Verifica la mappatura dei campi obbligatori (SKU, Prezzo)
- Controlla i log per vedere se ci sono errori di validazione
