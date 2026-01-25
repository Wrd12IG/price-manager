#!/bin/bash
# ============================================
# PRICE MANAGER - INSTALLAZIONE SISTEMA AUTOMATICO
# ============================================
# Esegui questo script sul Mac/PC che rimarrà sempre acceso
# per configurare l'esecuzione automatica del workflow

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_NAME="it.wrdigital.pricemanager.workflow.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"

echo "═══════════════════════════════════════════════════════════"
echo "   PRICE MANAGER - Installazione Sistema Automatico"
echo "═══════════════════════════════════════════════════════════"
echo ""

# 1. Verifica ambiente
echo "📋 Verifica ambiente..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js non trovato. Installalo prima di procedere."
    exit 1
fi
echo "   ✅ Node.js: $(node --version)"

if ! command -v npm &> /dev/null; then
    echo "❌ npm non trovato. Installalo prima di procedere."
    exit 1
fi
echo "   ✅ npm: $(npm --version)"

# 2. Installa dipendenze
echo ""
echo "📦 Installo dipendenze..."
cd "$SCRIPT_DIR"
npm install

cd "$SCRIPT_DIR/backend"
npm install

cd "$SCRIPT_DIR/frontend"
npm install

# 3. Copia LaunchAgent
echo ""
echo "⚙️ Configuro esecuzione automatica..."
mkdir -p "$LAUNCH_AGENTS_DIR"

# Aggiorna il path nel plist
PLIST_CONTENT=$(cat "$SCRIPT_DIR/$PLIST_NAME" | sed "s|/Users/wrdigital/.gemini/antigravity/scratch/ecommerce-price-manager|$SCRIPT_DIR|g")
echo "$PLIST_CONTENT" > "$LAUNCH_AGENTS_DIR/$PLIST_NAME"

# 4. Carica il LaunchAgent
echo "   Carico LaunchAgent..."
launchctl unload "$LAUNCH_AGENTS_DIR/$PLIST_NAME" 2>/dev/null || true
launchctl load "$LAUNCH_AGENTS_DIR/$PLIST_NAME"

echo "   ✅ LaunchAgent installato: $PLIST_NAME"

# 5. Verifica
echo ""
echo "🔍 Verifica configurazione..."
if launchctl list | grep -q "it.wrdigital.pricemanager"; then
    echo "   ✅ Job schedulato correttamente"
else
    echo "   ⚠️ Job non trovato nella lista"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "   ✅ INSTALLAZIONE COMPLETATA!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📅 Il workflow verrà eseguito automaticamente ogni giorno alle 03:00"
echo ""
echo "🔧 Comandi utili:"
echo "   - Test manuale:    ./run-daily-workflow.sh"
echo "   - Vedere log:      tail -f /tmp/pricemanager-cron.log"  
echo "   - Disattivare:     launchctl unload ~/Library/LaunchAgents/$PLIST_NAME"
echo "   - Riattivare:      launchctl load ~/Library/LaunchAgents/$PLIST_NAME"
echo ""
echo "🌐 Frontend: https://price-manager-backend.vercel.app"
echo "🔌 Backend:  https://price-manager-5ait.onrender.com"
echo ""
