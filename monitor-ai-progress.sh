#!/bin/bash

# Script di monitoraggio progresso AI enrichment
# Mostra statistiche in tempo reale e avvisa quando completo

echo "📊 Monitoraggio Generazione AI in corso..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$(dirname "$0")/backend"

# Funzione per ottenere statistiche
get_stats() {
    npx tsx -e "
    import { PrismaClient } from '@prisma/client';
    const prisma = new PrismaClient();
    
    async function getStats() {
        const [total, pending, ready, uploaded, errors, withIcecat] = await Promise.all([
            prisma.outputShopify.count(),
            prisma.outputShopify.count({ where: { statoCaricamento: 'pending' } }),
            prisma.outputShopify.count({ where: { statoCaricamento: 'ready' } }),
            prisma.outputShopify.count({ where: { statoCaricamento: 'uploaded' } }),
            prisma.outputShopify.count({ where: { statoCaricamento: 'error' } }),
            prisma.masterFile.count({ where: { datiIcecat: { isNot: null } } })
        ]);
        
        console.log(JSON.stringify({ total, pending, ready, uploaded, errors, withIcecat }));
        await prisma.\$disconnect();
    }
    
    getStats().catch(console.error);
    " 2>/dev/null
}

# Controlla se il processo è in esecuzione
check_process() {
    pgrep -f "run-ai-enrichment" > /dev/null
    return $?
}

# Loop di monitoraggio
LAST_TOTAL=0
START_TIME=$(date +%s)

while true; do
    STATS=$(get_stats)
    
    if [ -z "$STATS" ]; then
        echo "⚠️  Errore nel recupero statistiche. Riprovo..."
        sleep 5
        continue
    fi
    
    TOTAL=$(echo $STATS | grep -o '"total":[0-9]*' | cut -d':' -f2)
    PENDING=$(echo $STATS | grep -o '"pending":[0-9]*' | cut -d':' -f2)
    READY=$(echo $STATS | grep -o '"ready":[0-9]*' | cut -d':' -f2)
    UPLOADED=$(echo $STATS | grep -o '"uploaded":[0-9]*' | cut -d':' -f2)
    ERRORS=$(echo $STATS | grep -o '"errors":[0-9]*' | cut -d':' -f2)
    WITH_ICECAT=$(echo $STATS | grep -o '"withIcecat":[0-9]*' | cut -d':' -f2)
    
    # Calcola progresso
    if [ $WITH_ICECAT -gt 0 ]; then
        PERCENTAGE=$((TOTAL * 100 / WITH_ICECAT))
    else
        PERCENTAGE=0
    fi
    
    # Calcola velocità
    ELAPSED=$(($(date +%s) - START_TIME))
    if [ $ELAPSED -gt 0 ]; then
        RATE=$(((TOTAL - LAST_TOTAL) * 60 / ELAPSED))
    else
        RATE=0
    fi
    
    # Stima tempo rimanente
    REMAINING=$((WITH_ICECAT - TOTAL))
    if [ $RATE -gt 0 ]; then
        ETA_MIN=$((REMAINING / RATE))
    else
        ETA_MIN=0
    fi
    
    # Clear screen e mostra statistiche
    clear
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🧠 MONITORAGGIO GENERAZIONE AI - $(date '+%H:%M:%S')"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📦 PRODOTTI CON DATI ICECAT:    $WITH_ICECAT"
    echo "✅ PRODOTTI GENERATI:           $TOTAL / $WITH_ICECAT ($PERCENTAGE%)"
    echo ""
    echo "📊 STATO CARICAMENTO:"
    echo "   🟡 Pending (pronti Shopify): $PENDING"
    echo "   🟢 Ready:                    $READY"
    echo "   🔵 Uploaded:                 $UPLOADED"
    echo "   🔴 Errori:                   $ERRORS"
    echo ""
    echo "⚡ VELOCITÀ:                    ~$RATE prodotti/min"
    echo "⏱️  TEMPO RIMANENTE STIMATO:    ~$ETA_MIN minuti"
    echo ""
    
    # Barra di progresso
    BAR_WIDTH=50
    FILLED=$((PERCENTAGE * BAR_WIDTH / 100))
    printf "["
    for i in $(seq 1 $BAR_WIDTH); do
        if [ $i -le $FILLED ]; then
            printf "█"
        else
            printf "░"
        fi
    done
    printf "] $PERCENTAGE%%\n"
    echo ""
    
    # Controlla se il processo è ancora in esecuzione
    if ! check_process; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "✅ PROCESSO COMPLETATO!"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "🎉 Generazione AI terminata!"
        echo "📊 Prodotti pronti per Shopify: $PENDING"
        echo ""
        echo "🚀 PROSSIMI PASSI:"
        echo "   1. Apri l'applicazione web"
        echo "   2. Vai alla sezione Shopify"
        echo "   3. Premi 'Aggiorna Shopify' per caricare i $PENDING prodotti"
        echo ""
        
        # Notifica sonora (se disponibile)
        if command -v afplay &> /dev/null; then
            afplay /System/Library/Sounds/Glass.aiff 2>/dev/null &
        fi
        
        break
    fi
    
    echo "🔄 Aggiornamento ogni 5 secondi... (Ctrl+C per uscire)"
    echo "📝 Log completo: tail -f logs/ai-enrichment.log"
    
    LAST_TOTAL=$TOTAL
    sleep 5
done
