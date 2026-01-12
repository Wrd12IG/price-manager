#!/bin/bash

# ============================================================================
#         E-COMMERCE PRICE MANAGER - INSTALLAZIONE AUTOMATICA (Mac)
# ============================================================================
# Questo script installa tutto il necessario per far funzionare l'applicazione.
# Basta fare doppio clic per avviare l'installazione.
# ============================================================================

set -e

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Directory
INSTALL_DIR="$HOME/EcommercePriceManager"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
APPLICATIONS_DIR="/Applications"

# Porte
BACKEND_PORT=3000
FRONTEND_PORT=5173

print_banner() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${BOLD}E-commerce Price Manager${NC} - Installazione Automatica           ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  ${MAGENTA}W[r]Digital${NC}                                                     ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

show_progress() { echo -e "${YELLOW}➤${NC} $1"; }
show_success() { echo -e "${GREEN}✓${NC} $1"; }
show_error() { echo -e "${RED}✗${NC} $1"; }
show_warning() { echo -e "${YELLOW}⚠${NC} $1"; }

print_banner

echo -e "${BOLD}Questo script installerà l'applicazione E-commerce Price Manager.${NC}"
echo ""
echo "Premi INVIO per continuare o CTRL+C per annullare..."
read -r

# ============================================================================
# STEP 1: Verifica/Installa Homebrew
# ============================================================================
show_progress "Verifico Homebrew..."

if command -v brew &> /dev/null; then
    show_success "Homebrew trovato!"
else
    show_progress "Installo Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    if [[ $(uname -m) == 'arm64' ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    else
        eval "$(/usr/local/bin/brew shellenv)"
    fi
    show_success "Homebrew installato!"
fi

# ============================================================================
# STEP 2: Verifica/Installa Node.js
# ============================================================================
show_progress "Verifico Node.js..."

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    show_success "Node.js $NODE_VERSION trovato!"
else
    show_progress "Installo Node.js..."
    brew install node@20
    brew link --overwrite node@20 2>/dev/null || true
    show_success "Node.js installato!"
fi

# ============================================================================
# STEP 3: Verifica/Installa PostgreSQL
# ============================================================================
show_progress "Verifico PostgreSQL..."

if command -v psql &> /dev/null; then
    show_success "PostgreSQL trovato!"
else
    show_progress "Installo PostgreSQL..."
    brew install postgresql@16
    show_success "PostgreSQL installato!"
fi

# Avvia PostgreSQL
show_progress "Avvio PostgreSQL..."
brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null || true
sleep 2
show_success "PostgreSQL avviato!"

# ============================================================================
# STEP 4: Copia i file dell'applicazione
# ============================================================================
show_progress "Copio i file dell'applicazione in $INSTALL_DIR..."

mkdir -p "$INSTALL_DIR"

if [ -d "$SCRIPT_DIR/app" ]; then
    rsync -av --exclude='node_modules' --exclude='dist' --exclude='.next' --exclude='*.log' "$SCRIPT_DIR/app/" "$INSTALL_DIR/"
    show_success "File copiati!"
else
    show_error "Cartella 'app' non trovata nel pacchetto di installazione!"
    exit 1
fi

# ============================================================================
# STEP 5: Installa le dipendenze
# ============================================================================
show_progress "Installo le dipendenze (questo può richiedere qualche minuto)..."

cd "$INSTALL_DIR"

# Root dependencies
npm install --legacy-peer-deps 2>/dev/null || npm install
show_success "Dipendenze root installate!"

# Backend dependencies
cd "$INSTALL_DIR/backend"
npm install --legacy-peer-deps 2>/dev/null || npm install
show_success "Dipendenze backend installate!"

# Frontend dependencies
cd "$INSTALL_DIR/frontend"
npm install --legacy-peer-deps 2>/dev/null || npm install
show_success "Dipendenze frontend installate!"

cd "$INSTALL_DIR"

# ============================================================================
# STEP 6: Configura il database
# ============================================================================
show_progress "Configuro il database..."

# Crea database se non esiste
createdb ecommerce_price_manager 2>/dev/null || show_warning "Database già esistente"

# Crea file .env se non esiste
if [ ! -f "$INSTALL_DIR/backend/.env" ]; then
    cat > "$INSTALL_DIR/backend/.env" << 'ENVEOF'
# Database
DATABASE_URL="postgresql://localhost:5432/ecommerce_price_manager?schema=public"

# Server
PORT=3000
NODE_ENV=production

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=ecommerce-price-32-char-key-here

# Frontend URL
FRONTEND_URL=http://localhost:5173
ENVEOF
    show_success "File .env creato"
fi

# Prisma setup
cd "$INSTALL_DIR/backend"
npx prisma generate
npx prisma migrate deploy 2>/dev/null || npx prisma db push
show_success "Database configurato!"

cd "$INSTALL_DIR"

# ============================================================================
# STEP 7: Build dell'applicazione
# ============================================================================
show_progress "Compilo l'applicazione..."

# Build backend
cd "$INSTALL_DIR/backend"
npm run build 2>/dev/null || npx tsc
show_success "Backend compilato!"

# Build frontend
cd "$INSTALL_DIR/frontend"
npm run build
show_success "Frontend compilato!"

cd "$INSTALL_DIR"

# ============================================================================
# STEP 8: Crea script di avvio
# ============================================================================
show_progress "Creo gli script di avvio..."

# Script di avvio principale
cat > "$INSTALL_DIR/start-app.sh" << 'STARTSCRIPT'
#!/bin/bash
cd "$(dirname "$0")"

echo "Avvio E-commerce Price Manager..."

# Avvia PostgreSQL se non attivo
brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null || true
sleep 1

# Avvia backend
cd backend
npm run start &
BACKEND_PID=$!
cd ..

# Attendi che il backend sia pronto
sleep 3

# Avvia frontend in modalità preview
cd frontend
npm run preview -- --port 5173 &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Applicazione avviata!"
echo "   Backend:  http://localhost:3000"
echo "   Frontend: http://localhost:5173"
echo ""
echo "Premi CTRL+C per fermare..."

# Attendi
wait $BACKEND_PID $FRONTEND_PID
STARTSCRIPT
chmod +x "$INSTALL_DIR/start-app.sh"

# Script di stop
cat > "$INSTALL_DIR/stop-app.sh" << 'STOPSCRIPT'
#!/bin/bash
echo "Fermo E-commerce Price Manager..."
pkill -f "node.*3000" 2>/dev/null || true
pkill -f "vite.*5173" 2>/dev/null || true
echo "✅ Applicazione fermata"
STOPSCRIPT
chmod +x "$INSTALL_DIR/stop-app.sh"

show_success "Script di avvio creati!"

# ============================================================================
# STEP 9: Crea LaunchAgent per avvio automatico
# ============================================================================
show_progress "Configuro l'avvio automatico..."

mkdir -p "$LAUNCH_AGENTS_DIR"

NODE_PATH=$(which node)

cat > "$LAUNCH_AGENTS_DIR/com.wrdigital.ecommerce-price-manager.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.wrdigital.ecommerce-price-manager</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$INSTALL_DIR/start-app.sh</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>$INSTALL_DIR/logs/app.log</string>
    <key>StandardErrorPath</key>
    <string>$INSTALL_DIR/logs/error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
EOF

mkdir -p "$INSTALL_DIR/logs"

launchctl unload "$LAUNCH_AGENTS_DIR/com.wrdigital.ecommerce-price-manager.plist" 2>/dev/null || true
launchctl load "$LAUNCH_AGENTS_DIR/com.wrdigital.ecommerce-price-manager.plist"

show_success "Avvio automatico configurato!"

# ============================================================================
# STEP 10: Crea App Launcher
# ============================================================================
show_progress "Creo l'applicazione..."

APP_PATH="$APPLICATIONS_DIR/E-commerce Price Manager.app"

rm -rf "$APP_PATH"
mkdir -p "$APP_PATH/Contents/MacOS"
mkdir -p "$APP_PATH/Contents/Resources"

cat > "$APP_PATH/Contents/MacOS/E-commerce Price Manager" << 'LAUNCHER'
#!/bin/bash

# Attendi che il server sia pronto
MAX_WAIT=30
WAITED=0

while ! curl -s http://localhost:5173 > /dev/null 2>&1; do
    if [ $WAITED -ge $MAX_WAIT ]; then
        osascript -e 'display notification "Il server sta ancora avviando..." with title "E-commerce Price Manager"'
        break
    fi
    sleep 1
    WAITED=$((WAITED + 1))
done

# Apri nel browser
if [ -d "/Applications/Google Chrome.app" ]; then
    open -a "Google Chrome" --args --app="http://localhost:5173"
else
    open "http://localhost:5173"
fi
LAUNCHER
chmod +x "$APP_PATH/Contents/MacOS/E-commerce Price Manager"

cat > "$APP_PATH/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>E-commerce Price Manager</string>
    <key>CFBundleIdentifier</key>
    <string>com.wrdigital.ecommerce-price-manager</string>
    <key>CFBundleName</key>
    <string>E-commerce Price Manager</string>
    <key>CFBundleDisplayName</key>
    <string>E-commerce Price Manager</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
PLIST

show_success "App creata in /Applications!"

# ============================================================================
# STEP 11: Avvia l'applicazione
# ============================================================================
show_progress "Avvio l'applicazione..."

cd "$INSTALL_DIR"
./start-app.sh &

# Attendi che sia pronto
echo -n "Attendo che l'applicazione sia pronta"
MAX_WAIT=60
WAITED=0

while ! curl -s http://localhost:5173 > /dev/null 2>&1; do
    if [ $WAITED -ge $MAX_WAIT ]; then
        echo ""
        show_warning "L'applicazione sta ancora avviando..."
        break
    fi
    sleep 2
    WAITED=$((WAITED + 2))
    echo -n "."
done
echo ""

if curl -s http://localhost:5173 > /dev/null 2>&1; then
    show_success "Applicazione pronta!"
fi

# ============================================================================
# COMPLETATO
# ============================================================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}              ${BOLD}INSTALLAZIONE COMPLETATA! 🎉${NC}                          ${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "L'applicazione è stata installata:"
echo ""
echo "  📁 Directory:         $INSTALL_DIR"
echo "  🚀 App Launcher:      /Applications/E-commerce Price Manager.app"
echo "  🔄 Avvio automatico:  Configurato"
echo "  🌐 Frontend:          http://localhost:5173"
echo "  🔧 Backend API:       http://localhost:3000"
echo ""
echo -e "${YELLOW}⚠ IMPORTANTE:${NC} Configura le credenziali in:"
echo "  $INSTALL_DIR/backend/.env"
echo ""
echo "Premi INVIO per aprire l'applicazione..."
read -r

if [ -d "/Applications/Google Chrome.app" ]; then
    open -a "Google Chrome" --args --app="http://localhost:5173"
else
    open "http://localhost:5173"
fi

exit 0
