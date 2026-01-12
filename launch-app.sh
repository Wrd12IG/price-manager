#!/bin/bash

# 🚀 E-commerce Price Manager Launcher
# Questo script avvia l'applicazione e apre il browser

# Colori per output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Directory del progetto
PROJECT_DIR="/Users/wrdigital/.gemini/antigravity/scratch/ecommerce-price-manager"

# Log file
LOG_FILE="$PROJECT_DIR/logs/app-launcher.log"
mkdir -p "$PROJECT_DIR/logs"

# Funzione per logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
    echo -e "${BLUE}▶${NC} $1"
}

log_success() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ $1" >> "$LOG_FILE"
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠ $1" >> "$LOG_FILE"
    echo -e "${YELLOW}⚠${NC} $1"
}

# Mostra finestra di notifica
show_notification() {
    osascript -e "display notification \"$2\" with title \"E-commerce Price Manager\" subtitle \"$1\""
}

# Banner
clear
echo "╔════════════════════════════════════════════════════════════╗"
echo "║        E-commerce Price Manager - Launcher 🚀              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Vai alla directory del progetto
cd "$PROJECT_DIR" || exit 1

# Verifica se l'app è già in esecuzione
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 || lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    log_warning "L'applicazione sembra già in esecuzione!"
    echo ""
    echo "Vuoi:"
    echo "1) Aprire solo il browser"
    echo "2) Riavviare l'applicazione"
    echo "3) Annullare"
    echo ""
    read -p "Scelta (1/2/3): " choice
    
    case $choice in
        1)
            log "Apertura browser..."
            open "http://localhost:5173/dashboard"
            log_success "Browser aperto!"
            exit 0
            ;;
        2)
            log "Arresto servizi esistenti..."
            # Termina i processi sulle porte
            lsof -ti:3000 | xargs kill -9 2>/dev/null
            lsof -ti:5173 | xargs kill -9 2>/dev/null
            sleep 2
            log_success "Servizi arrestati"
            ;;
        *)
            log "Operazione annullata"
            exit 0
            ;;
    esac
fi

# Avvia l'applicazione
log "Avvio E-commerce Price Manager..."
show_notification "Avvio in corso..." "Attendi qualche secondo..."

# Avvia in background e salva il PID
nohup npm run dev > "$LOG_FILE" 2>&1 &
APP_PID=$!

# Salva il PID per poterlo terminare dopo
echo $APP_PID > "$PROJECT_DIR/logs/app.pid"

log "Applicazione avviata (PID: $APP_PID)"
log "Attendo che i servizi siano pronti..."

# Attendi che il backend sia pronto (max 30 secondi)
COUNTER=0
MAX_WAIT=30
while [ $COUNTER -lt $MAX_WAIT ]; do
    if curl -s http://localhost:3000/api/health >/dev/null 2>&1; then
        log_success "Backend pronto!"
        break
    fi
    sleep 1
    COUNTER=$((COUNTER + 1))
    echo -n "."
done

echo ""

# Attendi che il frontend sia pronto (max 30 secondi)
COUNTER=0
while [ $COUNTER -lt $MAX_WAIT ]; do
    if curl -s http://localhost:5173 >/dev/null 2>&1; then
        log_success "Frontend pronto!"
        break
    fi
    sleep 1
    COUNTER=$((COUNTER + 1))
    echo -n "."
done

echo ""
echo ""

# Apri il browser
log "Apertura browser..."
sleep 1
open "http://localhost:5173/dashboard"

log_success "Applicazione avviata con successo! 🎉"
show_notification "Pronto!" "L'applicazione è ora disponibile"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                  Applicazione Attiva! 🎉                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📱 Dashboard: ${BLUE}http://localhost:5173/dashboard${NC}"
echo "🔧 API:       ${BLUE}http://localhost:3000/api${NC}"
echo ""
echo "📋 Log disponibili in: logs/app-launcher.log"
echo ""
echo "⚠️  Per arrestare l'applicazione, chiudi questa finestra"
echo "    oppure esegui: kill $APP_PID"
echo ""
echo "Premi CTRL+C per terminare l'applicazione..."
echo ""

# Mantieni lo script in esecuzione
wait $APP_PID
