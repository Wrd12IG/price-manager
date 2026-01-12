# API Documentation

Base URL: `http://localhost:3000/api`

## Authentication

Tutti gli endpoint (eccetto `/health` e `/auth/*`) richiedono autenticazione JWT.

```http
Authorization: Bearer <token>
```

## Endpoints

### Health Check

#### GET /health

Verifica lo stato del server.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 12345
}
```

---

### Authentication

#### POST /api/auth/login

Login utente.

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "nome": "Admin",
    "ruolo": "admin"
  }
}
```

---

### Dashboard

#### GET /api/dashboard/stats

Ottieni statistiche dashboard.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalFornitori": 5,
    "totalProdotti": 1500,
    "ultimaEsecuzione": "2024-01-15T02:00:00.000Z",
    "prodottiImportatiOggi": 150
  }
}
```

---

### Fornitori

#### GET /api/fornitori

Ottieni tutti i fornitori.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nomeFornitore": "Cometa Network",
      "formatoFile": "CSV",
      "tipoAccesso": "http_auth",
      "attivo": true,
      "ultimaSincronizzazione": "2024-01-15T02:00:00.000Z",
      "_count": {
        "mappatureCampi": 7,
        "mappatureCategorie": 15,
        "listiniRaw": 500
      }
    }
  ]
}
```

#### GET /api/fornitori/:id

Ottieni un fornitore specifico.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nomeFornitore": "Cometa Network",
    "urlListino": "https://example.com/listino.csv",
    "formatoFile": "CSV",
    "tipoAccesso": "http_auth",
    "username": "user123",
    "passwordEncrypted": "***",
    "attivo": true,
    "mappatureCampi": [...],
    "mappatureCategorie": [...]
  }
}
```

#### POST /api/fornitori

Crea nuovo fornitore.

**Request:**
```json
{
  "nomeFornitore": "Nuovo Fornitore",
  "urlListino": "https://example.com/listino.csv",
  "formatoFile": "CSV",
  "tipoAccesso": "http_auth",
  "username": "user",
  "password": "pass123",
  "encoding": "UTF-8",
  "separatoreCSV": ";"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "nomeFornitore": "Nuovo Fornitore",
    ...
  }
}
```

#### PUT /api/fornitori/:id

Aggiorna fornitore.

**Request:** (stessi campi del POST)

**Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

#### DELETE /api/fornitori/:id

Elimina fornitore.

**Response:**
```json
{
  "success": true,
  "message": "Fornitore eliminato con successo"
}
```

#### POST /api/fornitori/:id/test-connection

Testa connessione al fornitore.

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "statusCode": 200,
    "contentType": "text/csv",
    "contentLength": "12345"
  }
}
```

#### GET /api/fornitori/:id/preview

Anteprima listino.

**Query Params:**
- `rows` (optional): numero di righe da mostrare (default: 5)

**Response:**
```json
{
  "success": true,
  "data": {
    "headers": ["Codice_Art", "Descrizione", "PrezzoNetto", "Disponib", "EAN"],
    "rows": [
      ["ABC123", "Mouse USB", "15.50", "25", "8001234567890"]
    ],
    "totalRows": 1500,
    "previewRows": 5
  }
}
```

---

### Mappature

#### GET /api/mappature/campi

Ottieni mappature campi.

#### GET /api/mappature/categorie

Ottieni mappature categorie.

---

### Regole Markup

#### GET /api/markup

Ottieni tutte le regole di markup.

---

### Master File

#### GET /api/master-file

Ottieni prodotti del master file.

**Query Params:**
- `page` (optional): numero pagina
- `limit` (optional): prodotti per pagina
- `search` (optional): ricerca per EAN/SKU/descrizione
- `categoria` (optional): filtra per categoria
- `marca` (optional): filtra per marca

---

### ICecat

#### GET /api/icecat

Ottieni configurazione ICecat.

---

### Shopify

#### GET /api/shopify

Ottieni configurazione Shopify.

---

### Scheduler

#### GET /api/scheduler/status

Ottieni stato scheduler.

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "cronExpression": "0 2 * * *",
    "nextExecution": "2024-01-16T02:00:00.000Z",
    "lastExecution": "2024-01-15T02:00:00.000Z"
  }
}
```

#### POST /api/scheduler/run

Esegui processo manualmente.

**Response:**
```json
{
  "success": true,
  "message": "Processo avviato",
  "jobId": "abc123"
}
```

---

### Logs

#### GET /api/logs

Ottieni log elaborazioni.

**Query Params:**
- `page` (optional): numero pagina
- `limit` (optional): log per pagina
- `fase` (optional): filtra per fase
- `stato` (optional): filtra per stato (success/warning/error)
- `from` (optional): data inizio
- `to` (optional): data fine

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 1,
        "dataEsecuzione": "2024-01-15T02:00:00.000Z",
        "faseProcesso": "ingestione",
        "stato": "success",
        "prodottiProcessati": 500,
        "prodottiErrore": 0,
        "durataSecondi": 45
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

---

## Error Responses

Tutti gli errori seguono questo formato:

```json
{
  "error": {
    "message": "Descrizione errore",
    "stack": "..." // solo in development
  }
}
```

### Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

- **Limite**: 100 richieste per 15 minuti per IP
- **Header Response**:
  - `X-RateLimit-Limit`: limite totale
  - `X-RateLimit-Remaining`: richieste rimanenti
  - `X-RateLimit-Reset`: timestamp reset

---

## Webhooks (Future)

### POST /api/webhooks/shopify

Ricevi webhook da Shopify.

### POST /api/webhooks/supplier

Ricevi notifiche dai fornitori.
