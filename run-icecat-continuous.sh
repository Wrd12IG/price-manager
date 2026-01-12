#!/bin/bash

# Script che esegue l'arricchimento Icecat in batch ripetuti fino al 100%
# Questo evita memory leak e timeout processando in chunk

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/icecat-continuous.log"

# Crea directory logs
mkdir -p "$LOG_DIR"

echo "🚀 Avvio arricchimento Icecat continuo (batch ripetuti)" | tee -a "$LOG_FILE"
echo "📝 Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

BATCH_COUNT=0
TOTAL_PROCESSED=0

while true; do
    BATCH_COUNT=$((BATCH_COUNT + 1))
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
    echo "📦 Batch #$BATCH_COUNT - $(date)" | tee -a "$LOG_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
    
    # Esegui un batch
    cd "$SCRIPT_DIR"
    npx tsx backend/run-icecat-batch.ts 2>&1 | tee -a "$LOG_FILE"
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -ne 0 ]; then
        echo "❌ Batch fallito con codice $EXIT_CODE" | tee -a "$LOG_FILE"
        echo "🛑 Arresto processo" | tee -a "$LOG_FILE"
        exit 1
    fi
    
    # Controlla se ci sono ancora prodotti da processare
    REMAINING=$(npx tsx -e "
        import { PrismaClient } from '@prisma/client';
        const prisma = new PrismaClient();
        prisma.masterFile.count({
            where: { eanGtin: { not: '' }, datiIcecat: { is: null } }
        }).then(count => {
            console.log(count);
            prisma.\$disconnect();
        });
    " 2>/dev/null)
    
    if [ "$REMAINING" = "0" ] || [ -z "$REMAINING" ]; then
        echo "" | tee -a "$LOG_FILE"
        echo "🎉 COMPLETATO AL 100%!" | tee -a "$LOG_FILE"
        echo "📊 Totale batch eseguiti: $BATCH_COUNT" | tee -a "$LOG_FILE"
        exit 0
    fi
    
    echo "" | tee -a "$LOG_FILE"
    echo "⏭️  Rimangono $REMAINING prodotti" | tee -a "$LOG_FILE"
    echo "⏸️  Pausa 5 secondi prima del prossimo batch..." | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    
    # Pausa tra batch per permettere al sistema di liberare risorse
    sleep 5
done
