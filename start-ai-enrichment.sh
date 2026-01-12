#!/bin/bash

# Script per avviare la generazione AI in background

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/ai-enrichment.log"

mkdir -p "$LOG_DIR"

echo "🧠 Avvio Generazione AI in background..."
echo "📝 Log: $LOG_FILE"

cd "$SCRIPT_DIR"
nohup npx tsx backend/run-ai-enrichment.ts > "$LOG_FILE" 2>&1 &
PID=$!

echo "✅ Processo avviato (PID: $PID)"
echo "📊 Monitora con: tail -f logs/ai-enrichment.log"
