# 📅 PIANO MONITORAGGIO FIX EMAIL - 4 Febbraio 2026

**Fix Applicati**: 3 Febbraio 2026, ore 16:47  
**Monitoraggio Previsto**: 4 Febbraio 2026, dopo le ore 3:30

---

## ✅ FIX APPLICATI (RECAP)

### 1. Database Timeout
- **Configurato**: 30 minuti (era 2 minuti)
- **Verificato**: ✅ Attivo su Supabase
- **Impatto**: Import listini non andrà più in timeout

### 2. AI Fallback - Record Mancanti
- **File**: `src/services/ShopifyExportService.ts`
- **Fix**: Gestione errore P2025 per record eliminati
- **Impatto**: Workflow non fallisce più per record mancanti

### 3. Email Notifica
- **Email**: help@computer.it
- **Precedente**: sante.dormio@gmail.com
- **Impatto**: Email workflow indirizzate correttamente

---

## 📊 RISULTATI ATTESI DOMANI

### Scenario Ideale ✅
```
Workflow eseguito: 1 volta (alle 3:00 AM)
Stato: SUCCESS
Durata: ~3-5 ore
Email inviate: 1 (a help@computer.it)
Contenuto: Report successo workflow
```

### Scenario Parziale ⚠️
```
Workflow eseguito: 1-3 volte
Stato: Alcuni ERRORI
Email inviate: 1-3
Azione: Analizzare errori specifici
```

### Scenario Problema ❌
```
Workflow eseguito: >5 volte
Stato: Tutti ERRORI
Email inviate: >5
Azione: Investigare nuovi errori
```

---

## 🔍 COME MONITORARE

### Opzione 1: Script Automatico (Raccomandato)

**Quando**: Domani 4 Febbraio, dopo le ore 8:00

```bash
cd /Users/wrdigital/.gemini/antigravity/scratch/ecommerce-price-manager/backend

# Esegui monitoraggio
npx ts-node src/scripts/monitor_workflow_fix.ts
```

**Output atteso**:
- Numero workflow eseguiti (dovrebbe essere 1)
- Stato di ogni workflow
- Dettagli eventuali errori
- Valutazione automatica del fix

### Opzione 2: Check Email

**Verifica casella**: help@computer.it

**Email attesa**:
```
Da: Price Manager
Oggetto: ✅ Report Workflow Price Manager
Ora ricezione: ~8:00 AM (dopo completamento workflow)
Contenuto: Report con tutte le fasi completate
```

**Se ricevi**:
- 1 email → ✅ Perfetto!
- 0 email → ⚠️ Workflow non eseguito o configurazione incompleta
- 2+ email → ❌ Problema persiste

### Opzione 3: Check Database

```bash
# Verifica log workflow
npx ts-node -e "
import prisma from './src/config/database';

const logs = await prisma.logElaborazione.findMany({
  where: {
    utenteId: 2,
    faseProcesso: 'WORKFLOW_COMPLETO',
    dataEsecuzione: {
      gte: new Date('2026-02-04T00:00:00')
    }
  }
});

console.log('Workflow oggi:', logs.length);
console.log('Stati:', logs.map(l => l.stato));

await prisma.\$disconnect();
"
```

---

## 📋 CHECKLIST MONITORAGGIO

### Mattina (ore 8:00-9:00)

- [ ] Eseguire script monitoraggio: `npx ts-node src/scripts/monitor_workflow_fix.ts`
- [ ] Verificare email ricevute su help@computer.it
- [ ] Controllare numero esecuzioni workflow (dovrebbe essere 1)
- [ ] Verificare stato workflow (dovrebbe essere SUCCESS)

### Valutazione Risultati

**Se tutto OK (1 workflow SUCCESS)**:
- [ ] ✅ Chiudere ticket "Email duplicate"
- [ ] ✅ Annotare fix come risolto
- [ ] ✅ Nessuna azione richiesta

**Se ci sono problemi**:
- [ ] ⚠️ Eseguire: `npx ts-node src/scripts/check_last_errors.ts`
- [ ] ⚠️ Analizzare dettagli errori
- [ ] ⚠️ Riportare errori specifici per troubleshooting

---

## 🔧 TROUBLESHOOTING RAPIDO

### Problema: Nessun workflow eseguito

**Verifica scheduler attivo**:
```bash
# Check se backend è running
ps aux | grep "npm run dev"

# Se non è attivo, avvia:
npm run dev
```

### Problema: Workflow fallisce ancora per timeout

**Verifica timeout database**:
```bash
npx ts-node -e "
import prisma from './src/config/database';
const r: any = await prisma.\$queryRaw\`SHOW statement_timeout\`;
console.log('Timeout:', r[0]?.statement_timeout);
await prisma.\$disconnect();
"
```

Dovrebbe mostrare `30min`. Se diverso, ri-applica fix su Supabase.

### Problema: Email non ricevute

**Verifica configurazione**:
```bash
npx ts-node -e "
import prisma from './src/config/database';
const cfg = await prisma.configurazioneSistema.findFirst({
  where: { utenteId: 2, chiave: 'notification_email' }
});
console.log('Email configurata:', cfg?.valore);
await prisma.\$disconnect();
"
```

Dovrebbe mostrare `help@computer.it`.

---

## 📞 CONTATTI

Se ci sono anomalie o domande:
- **Developer**: Assistant (via chat)
- **Log files**: `backend/logs/`
- **Database**: Supabase Dashboard

---

## 📝 NOTE IMPORTANTI

1. **Primo workflow post-fix**: Domani alle 3:00 AM
2. **Durata prevista**: 3-5 ore (completamento ~6:00-8:00 AM)
3. **Email report**: Dopo completamento (~8:00 AM)
4. **Script monitoraggio**: Eseguire dopo le 8:00 AM

---

**Status**: ✅ Fix applicati e pronti per test  
**Prossimo Check**: 4 Febbraio 2026, ore 8:00+  
**Percentuale Successo Attesa**: 95%

🎯 **BUONA FORTUNA!**
