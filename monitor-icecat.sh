#!/bin/bash

# Script per monitorare il progresso dell'arricchimento Icecat

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "📊 Monitoraggio Arricchimento Icecat"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Controlla stato dal database
cd "$SCRIPT_DIR"
npx tsx backend/check-enrichment-status.ts

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Controlla se il processo continuo è in esecuzione
if pgrep -f "run-icecat-continuous" > /dev/null; then
    PID=$(pgrep -f "run-icecat-continuous")
    echo "✅ Processo continuo in esecuzione (PID: $PID)"
    echo ""
    echo "📝 Ultimi 20 log:"
    tail -n 20 logs/icecat-continuous.log 2>/dev/null || echo "Log non disponibile"
else
    echo "⚠️  Nessun processo continuo in esecuzione"
    echo ""
    echo "Per avviarlo:"
    echo "  nohup ./run-icecat-continuous.sh > logs/icecat-continuous.log 2>&1 &"
fi
