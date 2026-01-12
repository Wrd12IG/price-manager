#!/bin/bash

# Script per fermare l'arricchimento Icecat in background

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOG_DIR="$SCRIPT_DIR/logs"
PID_FILE="$LOG_DIR/icecat-enrichment.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "⚠️  Nessun processo di arricchimento in esecuzione (PID file non trovato)"
    exit 1
fi

PID=$(cat "$PID_FILE")

if ! ps -p $PID > /dev/null 2>&1; then
    echo "⚠️  Il processo (PID: $PID) non è più in esecuzione"
    rm "$PID_FILE"
    exit 1
fi

echo "🛑 Arresto processo di arricchimento (PID: $PID)..."
kill $PID

# Attendi che il processo termini
sleep 2

if ps -p $PID > /dev/null 2>&1; then
    echo "⚠️  Il processo non si è fermato, forzo l'arresto..."
    kill -9 $PID
    sleep 1
fi

if ! ps -p $PID > /dev/null 2>&1; then
    echo "✅ Processo arrestato con successo"
    rm "$PID_FILE"
else
    echo "❌ Impossibile arrestare il processo"
    exit 1
fi
