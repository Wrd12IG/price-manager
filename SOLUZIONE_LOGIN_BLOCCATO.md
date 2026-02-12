# 🚨 PROBLEMA LOGIN PRICE MANAGER - SOLUZIONE

## ❌ PROBLEMA
Non è più possibile accedere a Price Manager con nessun utente, incluso l'amministratore.

## 🔍 CAUSA
Problema di timeout con il database Supabase che impedisce agli script di reset password di funzionare.

## ✅ SOLUZIONI DISPONIBILI

### SOLUZIONE 1: Reset Password via Supabase Dashboard (CONSIGLIATO)

1. **Accedi a Supabase Dashboard:**
   - URL: https://supabase.com
   - Accedi con le credenziali del progetto

2. **Vai al Database:**
   - Seleziona il progetto Price Manager
   - Vai su "Table Editor"
   - Seleziona la tabella "Utente"

3. **Reset Password:**
   - Trova l'utente (es. sante.dormio@gmail.com)
   - Modifica il campo `passwordHash`
   - Incolla questo valore:
   ```
   $2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIVInCBVVC
   ```
   - Salva

4. **Login:**
   - Email: sante.dormio@gmail.com (o altro utente)
   - Password: `admin123`

### SOLUZIONE 2: Reset via SQL Editor Supabase

1. Vai su Supabase → SQL Editor
2. Esegui questo codice:

```sql
UPDATE "Utente" 
SET "passwordHash" = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIVInCBVVC'
WHERE email = 'sante.dormio@gmail.com';
```

3. Login con:
   - Email: sante.dormio@gmail.com
   - Password: `admin123`

### SOLUZIONE 3: Esegui Script SQL Locale

Se hai `psql` installato:

```bash
cd backend

# Connettiti al database
psql "postgresql://postgres.cvqotrwbvvafkabhlmkx:Supabase2024!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"

# Esegui lo script
\i reset-passwords.sql
```

### SOLUZIONE 4: Credenziali Temporanee (se hai accesso fisico al server)

Se il backend sta girando in produzione su un server a cui hai accesso:

1. Ferma il backend
2. Modifica `src/controllers/auth.controller.ts`
3. Aggiungi bypass temporaneo:
```typescript
// TEMPORANEO - RIMUOVERE DOPO IL LOGIN
if (email === 'sante.dormio@gmail.com' && password === 'emergency123') {
    // Salta validazione password
    const user = await prisma.utente.findUnique({ where: { email }});
    // ... genera token e login
}
```
4. Riavvia backend
5. Accedi con email: `sante.dormio@gmail.com`, password: `emergency123`
6. Cambia password dall'interfaccia
7. Rimuovi il bypass dal codice

---

## 🔑 CREDENZIALI DOPO IL RESET

Dopo aver eseguito una delle soluzioni sopra:

### Utenti disponibili:
- **Email:** sante.dormio@gmail.com
- **Email:** roberto@wrdigital.it
- **Email:** luca@wrdigital.it
- **Email:** info@europccomputer.com

### Password per tutti:
```
admin123
```

### URL Login:
```
http://localhost:5173/login
```

---

## ⚠️ IMPORTANTE

### Dopo il login:
1. ✅ Cambia immediatamente la password
2. ✅ Vai su Shopify → Verifica stato sincronizzazione
3. ✅ Controlla i metafields

### Problema Metafields:
I metafields sono generati (289 prodotti) ma probabilmente non sono visibili su Shopify perché mancano le definizioni.

**Prossimi passi:**
1. Accedi a Price Manager ✅
2. Verifica stato prodotti
3. Sincronizza metafields su Shopify
4. Oppure crea le definizioni metafields manualmente su Shopify Admin

---

## 🔧 HASH PASSWORD PRECALCOLATI

Se serve resettare altre password, usa questi hash (tutti per `admin123`):

```
$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIVInCBVVC
```

Copia questo valore nel campo `passwordHash` della tabella `Utente` su Supabase.

---

## 📊 STATO SISTEMA

### ✅ Funzionante:
- Backend su porta 3000
- Frontend su porta 5173
- Database connesso
- 289 prodotti con metafields generati
- 228 prodotti caricati su Shopify

### ⚠️ Da Risolvere:
- Login bloccato (usa soluzione sopra)
- Metafields non visibili su Shopify (richiede creazione definizioni)

---

## 🚀 DOPO IL LOGIN

Una volta che riesci ad accedere:

1. **Verifica Prodotti:**
   - Vai su Dashboard
   - Controlla che i 289 prodotti siano presenti

2. **Shopify Status:**
   - Vai su Shopify → Stato Sincronizzazione
   - Verifica i 228 prodotti caricati

3. **Metafields:**
   - Apri Shopify Admin
   - Vai su un prodotto
   - Controlla se i metafields sono visibili
   - Se NO → Crea definizioni metafields

---

## 📞 SUPPORTO

Se nessuna soluzione funziona:
1. Verifica che Supabase sia raggiungibile
2. Controlla i log del backend: `backend/logs/app.log`
3. Verifica la stringa di connessione DATABASE_URL in `.env`

---

**PASSWORD RESET:** `admin123` (per tutti gli utenti)  
**URL LOGIN:** http://localhost:5173/login  
**METODO CONSIGLIATO:** Supabase Dashboard → Table Editor → Utente → Edit passwordHash
