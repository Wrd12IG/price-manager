#!/bin/bash

# Script per avviare l'arricchimento Icecat in background
# Può essere eseguito anche se chiudi il terminale

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOG_DIR="$SCRIPT_DIR/logs"
PID_FILE="$LOG_DIR/icecat-enrichment.pid"
LOG_FILE="$LOG_DIR/icecat-enrichment.log"

# Crea directory logs se non esiste
mkdir -p "$LOG_DIR"

# Controlla se è già in esecuzione
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo "⚠️  Arricchimento già in esecuzione (PID: $PID)"
        echo "📊 Controlla il progresso con: tail -f $LOG_FILE"
        exit 1
    else
        echo "🧹 Rimuovo PID file obsoleto..."
        rm "$PID_FILE"
    fi
fi

echo "🚀 Avvio arricchimento Icecat in background..."
echo "📝 Log salvato in: $LOG_FILE"
echo ""

# Avvia il processo in background con nohup
cd "$SCRIPT_DIR"
nohup npx tsx backend/run-icecat-enrichment.ts > "$LOG_FILE" 2>&1 &
PID=$!

# Salva il PID
echo $PID > "$PID_FILE"

echo "✅ Processo avviato (PID: $PID)"
echo ""
echo "📊 Per monitorare il progresso:"
echo "   tail -f $LOG_FILE"
echo ""
echo "🛑 Per fermare il processo:"
echo "   kill $PID"
echo "   oppure: kill \$(cat $PID_FILE)"
echo ""
echo "🔍 Per controllare lo stato:"
echo "   npx tsx backend/check-enrichment-status.ts"
