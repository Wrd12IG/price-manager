# E-commerce Price Manager

Sistema completo di gestione automatizzata dei listini per e-commerce con integrazione ICecat, AI e Shopify.

## 🎯 Caratteristiche Principali

- **Gestione Multi-Fornitore**: Importazione automatica da CSV, TSV, TXT, Excel, XML, JSON
- **Normalizzazione Dati**: Mappatura intelligente dei campi e categorie
- **Consolidamento**: Selezione automatica del miglior fornitore per prezzo
- **Arricchimento AI**: Descrizioni ottimizzate SEO generate con GPT-4/Claude/Gemini
- **Integrazione ICecat**: Download automatico di immagini e specifiche tecniche
- **Export Shopify**: Caricamento automatico via API o CSV
- **Scheduler**: Esecuzione automatica giornaliera configurabile
- **Dashboard Web**: Interfaccia completa per configurazione e monitoraggio

## 🏗️ Architettura

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                        │
│  Dashboard • Configurazione • Monitoraggio • Report          │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────────────┐
│                 BACKEND (Node.js + TypeScript)               │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │Ingestione│Normaliz. │Consolid. │Arricch.  │ Export   │  │
│  │ Listini  │  Dati    │  Master  │AI/ICecat │ Shopify  │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  DATABASE (PostgreSQL)                       │
│  Fornitori • Mappature • Listini • Master • Log             │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Stack Tecnologico

### Backend
- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **ORM**: Prisma
- **Database**: PostgreSQL 14+
- **Scheduler**: node-cron
- **Queue**: Bull (Redis-based)
- **Validation**: Zod
- **File Processing**: xlsx, csv-parser, xml2js

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **UI Library**: Material-UI (MUI)
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Forms**: React Hook Form
- **Charts**: Recharts

### Integrazioni
- **ICecat API**: Dati prodotto e immagini
- **OpenAI/Anthropic/Google**: Generazione descrizioni AI
- **Shopify Admin API**: Export automatico prodotti

## 🚀 Quick Start

### Prerequisiti
- Node.js 18+
- PostgreSQL 14+
- Redis (per job queue)
- npm o yarn

### Installazione

1. **Clone e setup**
```bash
cd ecommerce-price-manager
npm run setup
```

2. **Configurazione Database**
```bash
cd backend
cp .env.example .env
# Modifica .env con le tue credenziali
npm run db:migrate
npm run db:seed
```

3. **Avvio Backend**
```bash
cd backend
npm run dev
```

4. **Avvio Frontend**
```bash
cd frontend
npm run dev
```

5. **Accedi all'applicazione**
```
http://localhost:5173
```

## 📁 Struttura Progetto

```
ecommerce-price-manager/
├── backend/
│   ├── src/
│   │   ├── config/          # Configurazioni (DB, API, etc)
│   │   ├── controllers/     # Controller REST API
│   │   ├── models/          # Modelli Prisma
│   │   ├── services/        # Business logic
│   │   ├── routes/          # Route definitions
│   │   ├── jobs/            # Scheduled jobs
│   │   ├── middleware/      # Express middleware
│   │   └── utils/           # Utility functions
│   ├── prisma/
│   │   └── schema.prisma    # Schema database
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Componenti React riutilizzabili
│   │   ├── pages/           # Pagine applicazione
│   │   ├── services/        # API client
│   │   ├── types/           # TypeScript types
│   │   └── styles/          # CSS globali
│   └── package.json
├── database/
│   ├── migrations/          # SQL migrations
│   └── seeds/               # Dati di esempio
└── docs/                    # Documentazione

```

## 🔄 Flusso di Lavoro Automatico

### Setup Iniziale (One-Time)
1. Aggiungi fornitori e configura accesso ai listini
2. Mappa campi fornitore → campi standard
3. Mappa categorie fornitore → categorie e-commerce
4. Configura regole di markup (per prodotto/marca/categoria)
5. Configura credenziali ICecat
6. Configura API AI (OpenAI/Claude/Gemini)
7. Configura export Shopify

### Esecuzione Automatica Giornaliera
1. **Ingestione**: Download listini da tutti i fornitori
2. **Normalizzazione**: Applicazione mappature campi e categorie
3. **Consolidamento**: Creazione master file con miglior prezzo
4. **Arricchimento**: Download dati ICecat + generazione descrizioni AI
5. **Calcolo Prezzi**: Applicazione regole markup
6. **Export**: Generazione CSV Shopify o upload via API
7. **Notifica**: Email/Slack con report esecuzione

## 📊 Database Schema

### Tabelle Principali
- `fornitori`: Configurazione fornitori e accesso listini
- `mappatura_campi`: Mappatura campi fornitore → standard
- `mappatura_categorie`: Mappatura categorie fornitore → e-commerce
- `regole_markup`: Regole di pricing (prodotto/marca/categoria)
- `listini_raw`: Dati grezzi importati
- `master_file`: Catalogo consolidato
- `dati_icecat`: Dati arricchiti da ICecat
- `output_shopify`: Output formattato per Shopify
- `log_elaborazioni`: Storico esecuzioni

## 🎨 Interfacce Principali

1. **Dashboard**: Overview stato sistema, ultime esecuzioni, statistiche
2. **Fornitori**: Gestione fornitori e test connessioni
3. **Mappature**: Configurazione mappatura campi e categorie
4. **Pricing**: Gestione regole di markup
5. **Integrazioni**: Configurazione ICecat, AI, Shopify
6. **Scheduler**: Pianificazione esecuzioni automatiche
7. **Log & Monitor**: Visualizzazione log e troubleshooting
8. **Master File**: Visualizzazione e ricerca catalogo consolidato

## 🔐 Sicurezza

- Credenziali criptate in database (AES-256)
- API protette con JWT authentication
- Rate limiting su endpoint pubblici
- Validazione input con Zod
- SQL injection prevention (Prisma ORM)
- CORS configurato

## 📈 Monitoraggio

- Log dettagliati per ogni fase del processo
- Metriche: prodotti processati, errori, tempi esecuzione
- Notifiche email/Slack in caso di errori
- Dashboard con grafici e statistiche

## 🛠️ Sviluppo

```bash
# Backend
cd backend
npm run dev          # Development server
npm run build        # Build production
npm run test         # Run tests
npm run db:studio    # Prisma Studio (DB GUI)

# Frontend
cd frontend
npm run dev          # Development server
npm run build        # Build production
npm run preview      # Preview production build
```

## 📝 Licenza

MIT

## 👥 Supporto

Per domande o supporto, contatta: admin@tuonegozio.it
