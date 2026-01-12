# Guida Setup - E-commerce Price Manager

## 📋 Prerequisiti

Prima di iniziare, assicurati di avere installato:

- **Node.js** 18 o superiore ([Download](https://nodejs.org/))
- **PostgreSQL** 14 o superiore ([Download](https://www.postgresql.org/download/))
- **Redis** (opzionale, per job queue) ([Download](https://redis.io/download))
- **npm** o **yarn**

## 🚀 Installazione Rapida

### 1. Installazione Dipendenze

```bash
cd ecommerce-price-manager
npm install
```

Questo comando installerà tutte le dipendenze per backend e frontend grazie alla configurazione workspace.

### 2. Configurazione Database

#### Crea il database PostgreSQL:

```bash
# Accedi a PostgreSQL
psql -U postgres

# Crea il database
CREATE DATABASE ecommerce_price_manager;

# Esci
\q
```

#### Configura le variabili d'ambiente:

```bash
cd backend
cp .env.example .env
```

Modifica il file `.env` con le tue credenziali:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/ecommerce_price_manager?schema=public"
JWT_SECRET=your-super-secret-jwt-key-change-this
ENCRYPTION_KEY=your-32-character-encryption-key
```

#### Esegui le migrazioni:

```bash
cd backend
npm run db:generate
npm run db:migrate
```

### 3. Avvio Applicazione

#### Opzione A: Avvio Completo (Backend + Frontend)

Dalla root del progetto:

```bash
npm run dev
```

#### Opzione B: Avvio Separato

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

### 4. Accesso all'Applicazione

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## 🔧 Configurazione Iniziale

### 1. Aggiungi un Fornitore

1. Vai su **Fornitori** nel menu
2. Clicca su **Nuovo Fornitore**
3. Compila i campi:
   - Nome Fornitore
   - URL Listino
   - Formato File (CSV, Excel, XML, JSON)
   - Tipo Accesso
   - Credenziali (se necessario)
4. Clicca **Salva**
5. Testa la connessione con l'icona WiFi

### 2. Configura Mappature Campi

1. Vai su **Mappature**
2. Seleziona il fornitore
3. Mappa i campi del listino ai campi standard:
   - SKU Fornitore
   - EAN/GTIN
   - Descrizione
   - Prezzo Acquisto
   - Quantità
   - Categoria
   - Marca

### 3. Configura Regole di Pricing

1. Vai su **Pricing & Markup**
2. Aggiungi regole per:
   - Prodotti specifici (priorità massima)
   - Marche
   - Categorie
   - Default (fallback)
3. Imposta:
   - Markup percentuale
   - Markup fisso
   - Costo spedizione

### 4. Configura Integrazioni

#### ICecat:
1. Vai su **Integrazioni** → **ICecat**
2. Inserisci username e API key
3. Seleziona lingua preferita
4. Testa credenziali

#### AI (OpenAI/Claude/Gemini):
1. Vai su **Integrazioni** → **AI**
2. Scegli provider
3. Inserisci API key
4. Personalizza prompt (opzionale)

#### Shopify:
1. Vai su **Integrazioni** → **Shopify**
2. Inserisci:
   - Shop URL
   - API Key
   - API Password
3. Testa connessione

### 5. Configura Scheduler

1. Vai su **Scheduler**
2. Imposta frequenza esecuzione
3. Configura notifiche email/Slack
4. Attiva esecuzione automatica

## 🔄 Esecuzione Manuale

Per testare il processo completo:

1. Vai su **Scheduler**
2. Clicca **Esegui Ora**
3. Monitora l'esecuzione in **Log & Monitor**

## 📊 Prisma Studio (GUI Database)

Per visualizzare e modificare i dati del database:

```bash
cd backend
npm run db:studio
```

Apri http://localhost:5555

## 🛠️ Comandi Utili

### Backend

```bash
# Development
npm run dev

# Build production
npm run build

# Start production
npm start

# Database
npm run db:migrate      # Esegui migrazioni
npm run db:generate     # Genera Prisma Client
npm run db:studio       # Apri Prisma Studio
npm run db:seed         # Popola dati di esempio

# Linting
npm run lint
```

### Frontend

```bash
# Development
npm run dev

# Build production
npm run build

# Preview production build
npm run preview

# Linting
npm run lint
```

## 🐛 Troubleshooting

### Errore: "Cannot connect to database"

- Verifica che PostgreSQL sia avviato
- Controlla le credenziali in `.env`
- Verifica che il database esista

### Errore: "Port 3000 already in use"

- Cambia la porta in `backend/.env`: `PORT=3001`
- Oppure termina il processo sulla porta 3000

### Errore: "Module not found"

```bash
# Reinstalla dipendenze
rm -rf node_modules
npm install
```

### Frontend non si connette al backend

- Verifica che il backend sia avviato
- Controlla il proxy in `frontend/vite.config.ts`
- Verifica CORS in `backend/src/index.ts`

## 📚 Prossimi Passi

1. ✅ Aggiungi fornitori
2. ✅ Configura mappature
3. ✅ Imposta regole pricing
4. ✅ Configura integrazioni
5. ✅ Testa esecuzione manuale
6. ✅ Attiva scheduler automatico
7. ✅ Monitora log ed esecuzioni

## 🔐 Sicurezza

### Chiave di Encryption

Genera una chiave sicura per `ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### JWT Secret

Genera un secret sicuro per `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 📞 Supporto

Per problemi o domande:
- Controlla i log in `backend/logs/`
- Verifica la sezione **Log & Monitor** nell'app
- Consulta la documentazione API

## 🎉 Buon Lavoro!

Ora sei pronto per automatizzare la gestione dei tuoi listini e-commerce! 🚀
