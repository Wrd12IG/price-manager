# 📚 Documentazione E-commerce Price Manager

Benvenuto nella documentazione del sistema di gestione automatizzata dei listini per e-commerce.

## 📖 Documenti Disponibili

### [SETUP.md](./SETUP.md) - Guida Setup Completa
**Quando usarlo**: Prima installazione e configurazione del sistema

**Contenuto**:
- ✅ Prerequisiti e installazione
- ✅ Configurazione database
- ✅ Setup backend e frontend
- ✅ Configurazione iniziale (fornitori, mappature, pricing)
- ✅ Troubleshooting comuni
- ✅ Comandi utili

**Tempo stimato**: 15-20 minuti

---

### [API.md](./API.md) - Documentazione API
**Quando usarlo**: Sviluppo frontend, integrazioni, testing

**Contenuto**:
- ✅ Tutti gli endpoint REST
- ✅ Request/Response examples
- ✅ Autenticazione JWT
- ✅ Error handling
- ✅ Rate limiting
- ✅ Query parameters

**Utile per**: Sviluppatori frontend, integrazioni esterne

---

### [WORKFLOW.md](./WORKFLOW.md) - Flusso di Lavoro Automatico
**Quando usarlo**: Capire come funziona il processo automatico

**Contenuto**:
- ✅ Diagramma flusso completo
- ✅ Dettaglio di ogni fase (8 fasi)
- ✅ Gestione errori
- ✅ Configurazione scheduler
- ✅ Monitoraggio e metriche
- ✅ Best practices

**Utile per**: Amministratori, DevOps, troubleshooting

---

## 🚀 Quick Links

### Per Iniziare
1. Leggi [SETUP.md](./SETUP.md) per installare il sistema
2. Segui la guida passo-passo
3. Testa con un fornitore di esempio

### Per Sviluppare
1. Consulta [API.md](./API.md) per gli endpoint
2. Usa Prisma Studio per esplorare il database
3. Controlla i log in `backend/logs/`

### Per Capire il Sistema
1. Leggi [WORKFLOW.md](./WORKFLOW.md) per il flusso completo
2. Studia lo schema database in `backend/prisma/schema.prisma`
3. Esplora il codice partendo da `backend/src/index.ts`

---

## 📁 Struttura Progetto

```
ecommerce-price-manager/
├── backend/           # API Node.js + TypeScript
├── frontend/          # React + Material-UI
├── docs/             # 📚 Questa directory
├── database/         # Migrations e seeds
└── README.md         # Overview progetto
```

---

## 🎯 Scenari d'Uso

### Scenario 1: Primo Setup
```bash
# 1. Leggi SETUP.md
# 2. Esegui quick-start.sh
./quick-start.sh

# 3. Configura .env
nano backend/.env

# 4. Avvia
npm run dev
```

### Scenario 2: Aggiungere un Fornitore
```
1. Vai su Fornitori → Nuovo Fornitore
2. Compila i dati (vedi SETUP.md sezione "Aggiungi un Fornitore")
3. Testa connessione
4. Configura mappature (vedi SETUP.md sezione "Configura Mappature")
```

### Scenario 3: Debugging Processo Automatico
```
1. Controlla log in backend/logs/error.log
2. Consulta WORKFLOW.md per capire la fase
3. Verifica tabella log_elaborazioni nel database
4. Controlla configurazione specifica della fase
```

### Scenario 4: Integrare con API Esterna
```
1. Consulta API.md per endpoint disponibili
2. Usa JWT per autenticazione
3. Rispetta rate limiting (100 req/15min)
4. Gestisci errori secondo formato standard
```

---

## 🔧 Tools Utili

### Prisma Studio
Interfaccia grafica per il database:
```bash
cd backend
npm run db:studio
# Apri http://localhost:5555
```

### Logs in Real-Time
```bash
# Backend logs
tail -f backend/logs/combined.log

# Error logs
tail -f backend/logs/error.log
```

### Database Query
```bash
# Connetti a PostgreSQL
psql -d ecommerce_price_manager

# Query utili
SELECT * FROM fornitori;
SELECT * FROM master_file LIMIT 10;
SELECT * FROM log_elaborazioni ORDER BY data_esecuzione DESC LIMIT 5;
```

---

## 📊 Diagrammi

### Architettura Sistema
```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTP
       ▼
┌─────────────┐     ┌──────────────┐
│   React     │────▶│   Express    │
│  Frontend   │     │   Backend    │
└─────────────┘     └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  PostgreSQL  │
                    │   Database   │
                    └──────────────┘
```

### Flusso Dati
```
Fornitori → Ingestione → Normalizzazione → Consolidamento
                                                 │
                                                 ▼
Shopify ← Export ← Pricing ← Arricchimento ← Master File
```

---

## 🆘 Supporto

### Problemi Comuni

**Database non si connette**
→ Vedi SETUP.md sezione "Troubleshooting"

**API ritorna 401**
→ Vedi API.md sezione "Authentication"

**Processo automatico non parte**
→ Vedi WORKFLOW.md sezione "Troubleshooting"

**Frontend non si connette al backend**
→ Verifica proxy in `frontend/vite.config.ts`

### Dove Cercare Aiuto

1. **Documentazione**: Leggi i file in questa directory
2. **Logs**: Controlla `backend/logs/`
3. **Database**: Usa Prisma Studio per esplorare i dati
4. **Codice**: Commenti inline nel codice sorgente

---

## 📝 Contribuire alla Documentazione

Se trovi errori o vuoi migliorare la documentazione:

1. Modifica i file `.md` in questa directory
2. Usa Markdown per formattazione
3. Aggiungi esempi pratici
4. Mantieni la struttura esistente

---

## 🎓 Risorse Esterne

### Tecnologie Utilizzate
- [Node.js](https://nodejs.org/docs)
- [TypeScript](https://www.typescriptlang.org/docs/)
- [Express.js](https://expressjs.com/)
- [Prisma](https://www.prisma.io/docs)
- [React](https://react.dev/)
- [Material-UI](https://mui.com/)

### API Esterne
- [ICecat API](https://icecat.biz/en/menu/partners/index.html)
- [Shopify API](https://shopify.dev/api/admin-rest)
- [OpenAI API](https://platform.openai.com/docs)

---

**Ultimo aggiornamento**: 2024-01-15

**Versione documentazione**: 1.0.0
