# 📦 Guida all'Installazione - E-commerce Price Manager

## Prerequisiti

Prima di installare l'applicazione, assicurati di avere:

### Mac
- **Homebrew** (verrà installato automaticamente se mancante)
- **Node.js 18+** (verrà installato automaticamente se mancante)
- **PostgreSQL** (opzionale, richiesto per il database)

### Windows
- **Node.js 18+** - Scarica da [nodejs.org](https://nodejs.org/)
- **PostgreSQL** - Scarica da [postgresql.org](https://www.postgresql.org/download/windows/)

---

## 🍎 Installazione su Mac

1. **Copia la cartella del progetto** sul nuovo Mac

2. **Apri il Terminale** e naviga nella cartella del progetto:
   ```bash
   cd /percorso/alla/cartella/ecommerce-price-manager
   ```

3. **Esegui lo script di installazione**:
   ```bash
   ./install-mac.sh
   ```

4. **Segui le istruzioni a schermo** per configurare il database

5. **Configura le credenziali** nel file `backend/.env`

6. **Avvia l'applicazione**:
   ```bash
   ./launch-app.sh
   ```
   oppure:
   ```bash
   npm run dev
   ```

---

## 🪟 Installazione su Windows

1. **Copia la cartella del progetto** sul nuovo PC Windows

2. **Fai doppio click** su `install-windows.bat`

3. **Segui le istruzioni a schermo** per completare l'installazione

4. **Configura le credenziali** nel file `backend\.env`

5. **Avvia l'applicazione** facendo doppio click su `start-app.bat`
   oppure da terminale:
   ```cmd
   npm run dev
   ```

---

## ⚙️ Configurazione Post-Installazione

Dopo l'installazione, modifica il file `backend/.env` con le tue credenziali:

### Database
```env
DATABASE_URL="postgresql://utente:password@localhost:5432/ecommerce_price_manager"
```

### Shopify (per sincronizzazione prodotti)
```env
SHOPIFY_SHOP_URL=tuo-negozio.myshopify.com
SHOPIFY_API_KEY=...
SHOPIFY_API_PASSWORD=...
```

### Icecat (per arricchimento dati)
```env
ICECAT_USERNAME=...
ICECAT_API_KEY=...
```

### Email (per notifiche)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tua-email@gmail.com
SMTP_PASSWORD=...
```

---

## 🌐 Accesso all'Applicazione

Dopo l'avvio, l'applicazione sarà disponibile su:

- **Frontend (Dashboard)**: http://localhost:5173
- **Backend (API)**: http://localhost:3000

---

## 🔧 Comandi Utili

| Comando | Descrizione |
|---------|-------------|
| `npm run dev` | Avvia in modalità sviluppo |
| `npm run build` | Compila per produzione |
| `cd backend && npx prisma studio` | Apri Prisma Studio (gestione DB) |
| `cd backend && npx prisma migrate dev` | Esegui migrazioni database |

---

## ❓ Risoluzione Problemi

### Errore: "Node.js non trovato"
Installa Node.js da [nodejs.org](https://nodejs.org/)

### Errore: "Connessione database fallita"
1. Verifica che PostgreSQL sia in esecuzione
2. Controlla le credenziali in `backend/.env`
3. Verifica che il database esista

### Errore: "Porta già in uso"
Termina i processi sulle porte 3000 e 5173:
- **Mac**: `lsof -ti:3000 | xargs kill -9`
- **Windows**: Usa Task Manager

---

## 📞 Supporto

Per assistenza, contatta il team W[r]Digital.
