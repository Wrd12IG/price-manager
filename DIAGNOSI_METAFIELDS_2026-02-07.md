# 🔍 DIAGNOSI PROBLEMI METAFIELDS SHOPIFY - 2026-02-07 15:18

## 📊 STATO ATTUALE DEL SISTEMA

### ✅ COSA FUNZIONA:
1. **Backend attivo** - Server su porta 3000 ✅
2. **Frontend attivo** - Dashboard su porta 5173 ✅
3. **Metafields generati** - Tutti i 289 prodotti hanno metafields ✅
4. **Prodotti su Shopify** - 228 prodotti caricati ✅

### ❌ PROBLEMI IDENTIFICATI:

#### 1. **Impossibile accedere a Price Manager**
**Causa:** Password errata per sante.dormio@gmail.com

**Soluzione:**
```bash
cd backend
npx tsx reset-sante-password.ts
```
Oppure usa un altro utente (roberto@wr

digital.it, luca@wrdigital.it)

#### 2. **Metafields non visibili su Shopify** ⚠️
**Status database:**
- 289 prodotti con metafields nel database ✅
- 228 prodotti caricati su Shopify ✅
- **MA:** I metafields probabilmente non sono stati sincronizzati correttamente

## 🎯 CAUSA PROBABILE

Il problema è che **i metafields sono nel database Price Manager**, ma **NON sono stati trasmessi a Shopify** durante la sincronizzazione.

### Possibili cause:

1. **API Shopify Metafields non chiamata**
   - I prodotti sono stati creati/aggiornati su Shopify
   - Ma i metafields non sono stati inviati separatamente

2. **Formato metafields errato**
   - Shopify richiede un formato specifico per i metafields
   - Namespace: `custom`
   - Type: `single_line_text_field`, `multi_line_text_field`, etc.

3. **Metafield definitions mancanti**
   - Shopify richiede che i metafields siano prima "definiti" nell'admin
   - Se non sono definiti, possono essere creati ma non visualizzati

## 🔧 SOLUZIONI

### SOLUZIONE 1: Verifica su Shopify Admin (IMMEDIATA

)

1. Accedi a **Shopify Admin** del merchant Sante
2. Vai su **Impostazioni → Custom Data → Metafields**
3. Seleziona **Products**
4. Verifica se ci sono definizioni per:
   - `custom.processore_brand`
   - `custom.ram`
   - `custom.capacita_ssd`
   - `custom.scheda_video`
   - etc.

**Se NON ci sono:** I metafields esistono ma non sono visualizzabili

**Soluzione:** Creare le definizioni metafields su Shopify

### SOLUZIONE 2: Ri-sincronizzare i Metafields

Il codice attuale (EnhancedMetafieldService) genera i metafields ma potrebbero non essere stati inviati correttamente.

**Opzioni:**

#### A. Via API Shopify GraphQL (CONSIGLIATO)
Creo uno script che:
1. Prende i prodotti con metafields dal database
2. Li sincronizza su Shopify usando GraphQL Metafields API
3. Crea automaticamente le definizioni se necessario

#### B. Via Dashboard Price Manager
1. Accedi a Price Manager
2. Vai su Shopify → Sincronizza Metafields
3. Seleziona i prodotti
4. Clicca "Sincronizza"

### SOLUZIONE 3: Creare Definizioni Metafields

Se Shopify non mostra i metafields, probabilmente mancano le definizioni.

**Script per creare definizioni automaticamente:**
```typescript
// Crea definizioni metafields su Shopify
const definitions = [
  {
    namespace: 'custom',
    key: 'processore_brand',
    name: 'Processore',
    type: 'single_line_text_field',
    description: 'Modello del processore'
  },
  {
    namespace: 'custom',
    key: 'ram',
    name: 'RAM',
    type: 'single_line_text_field',
    description: 'Capacità RAM'
  },
  // ... altri metafields
];
```

## 📋 METAFIELDS DA CREARE SU SHOPIFY

Per visualizzare correttamente i metafields, Shopify richiede queste definizioni:

### Metafields Hardware:
1. `custom.processore_brand` - Single line text
2. `custom.ram` - Single line text
3. `custom.capacita_ssd` - Single line text
4. `custom.scheda_video` - Single line text
5. `custom.sistema_operativo` - Single line text

### Metafields Display:
6. `custom.dimensione_monitor` - Single line text
7. `custom.risoluzione_monitor` - Single line text
8. `custom.rapporto_aspetto` - Single line text

### Metafields Info:
9. `custom.tipo_pc` - Single line text
10. `custom.marca` - Single line text
11. `custom.categoria_prodotto` - Single line text
12. `custom.ean` - Single line text

### Metafields Descrizioni:
13. `custom.descrizione_breve` - Multi-line text
14. `custom.descrizione_lunga` - Multi-line text
15. `custom.tabella_specifiche` - Multi-line text (HTML)

### Metafields Extra:
16. `custom.peso` - Single line text
17. `custom.batteria` - Single line text
18. `custom.connettivita` - Multi-line text
19. `custom.porte` - Multi-line text

## 🚀 AZIONI IMMEDIATE

### 1. Verifica Manuale su Shopify (5 minuti)
```
1. Apri Shopify Admin
2. Vai su Prodotti
3. Apri un prodotto qualsiasi
4. Scorri fino a "Metafields"
5. Controlla se vedi i metafields custom.*
```

**Se vedi i metafields:** ✅ Tutto OK, sono solo nascosti dalla UI
**Se NON li vedi:** ❌ Mancano le definizioni o non sono stati sincronizzati

### 2. Sincronizza Metafields da Price Manager

**Metodo A - Reset password e accedi:**
```bash
cd backend
# Crea script per reset password semplice
echo "import prisma from './src/config/database';" > reset-pwd.ts
# ...completa lo script
npx tsx reset-pwd.ts
```

**Metodo B - Usa API diretta:**
Posso creare uno script che:
- Legge metafields dal database
- Li invia a Shopify via API
- Crea le definizioni necessarie

### 3. Crea Definizioni Metafields su Shopify

**Manualmente:**
1. Shopify Admin → Settings → Custom data
2. Products → Add definition
3. Per ogni metafield sopra, crea la definizione

**Automaticamente:**
Script GraphQL che crea tutte le definizioni in batch

## 📍 PROSSIMI PASSI CONSIGLIATI

### OPZIONE A: Manuale (15-20 minuti)
1. Accedi a Shopify Admin
2. Crea le definizioni metafields manualmente
3. I metafields esistenti diventeranno visibili

### OPZIONE B: Automatica (CONSIGLIATO)
1. Ti creo uno script che:
   - Sincronizza i metafields esistenti
   - Crea le definizioni su Shopify
   - Verifica il risultato
2. Esegui lo script
3. Verifica su Shopify

## 🐛 DEBUG: Come verificare

### Verifica Metafields nel database:
```bash
cd backend
npx tsx check-single-product.ts
```

### Verifica su Shopify via API:
```bash
# Controlla se i metafields sono su Shopify
curl -X GET \
  "https://SHOP_NAME.myshopify.com/admin/api/2024-01/products/PRODUCT_ID/metafields.json" \
  -H "X-Shopify-Access-Token: YOUR_TOKEN"
```

Se il risultato è vuoto `[]`, i metafields NON sono stati sincronizzati.

## 💡 CONCLUSIONE

**Problema principale:** I metafields sono generati e salvati nel database Price Manager, ma probabilmente:
1. Non sono stati inviati a Shopify durante la sincronizzazione
2. Oppure mancano le definizioni su Shopify per visualizzarli

**Soluzione rapida:** Creare le definizioni metafields su Shopify Admin e ri-sincronizzare.

**Soluzione automatica:** Script che sincronizza metafields e crea definizioni automaticamente.

---

**Quale soluzione preferisci?**
A) Creo script automatico per sincronizzare metafields + creare definizioni
B) Ti guido passo-passo per la configurazione manuale su Shopify
C) Verifichiamo prima su Shopify se i metafields ci sono ma sono solo nascosti
