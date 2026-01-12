# Rimozione Ricalcoli Automatici e Pulsante Ricalcola

Ho completato le richieste di disabilitare i ricalcoli automatici e rimuovere il pulsante di ricalcolo manuale.

## Modifiche Apportate

### 1. Backend: Filtri Prodotti (`ProductFilterController.ts`)
- Rimossa la chiamata automatica a `MasterFileService.consolidaMasterFile()` dopo:
  - Creazione regola (`createRule`)
  - Aggiornamento regola (`updateRule`)
  - Eliminazione regola (`deleteRule`)
  - Attivazione/Disattivazione regola (`toggleRule`)
  - Attivazione preset (`activatePreset`)
- Aggiornati i messaggi di risposta API per rimuovere riferimenti al "Ricalcolo in corso".

### 2. Backend: Regole di Pricing (`markup.controller.ts`)
- Rimossa la chiamata automatica a `MarkupService.applicaRegolePrezzi()` dopo:
  - Creazione regola (`createRegola`)
  - Eliminazione regola (`deleteRegola`)
- Aggiornati i messaggi di risposta API per rimuovere riferimenti al ricalcolo prezzi.

### 3. Frontend: Pagina Pricing (`Pricing.tsx`)
- Rimosso il pulsante "Ricalcola Prezzi".
- Rimossa la funzione `handleCalculate` e lo stato `calculating`.
- Rimossa l'icona `CalculateIcon`.
- Aggiornati i messaggi di notifica (Toast) per confermare solo l'azione (creazione/eliminazione) senza menzionare aggiornamenti di prodotti.

## Risultato
Ora la creazione o modifica di regole (sia di filtro che di pricing) è immediata e non innesca processi pesanti di ricalcolo. Il ricalcolo dei prezzi dovrà essere gestito separatamente o tramite processi schedulati se necessario in futuro.
