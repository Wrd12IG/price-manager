#!/bin/bash

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║         E-commerce Price Manager - Installazione per Mac                   ║
# ║         W[r]Digital - Script di Setup Automatico                           ║
# ╚════════════════════════════════════════════════════════════════════════════╝

set -e

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Funzioni di output
print_banner() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${BOLD}W${YELLOW}[${NC}${BOLD}r${YELLOW}]${NC}${BOLD}Digital${NC} - E-commerce Price Manager                          ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  ${MAGENTA}Installazione Automatica per macOS${NC}                              ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "\n${BLUE}▶${NC} ${BOLD}$1${NC}"
}

print_substep() {
    echo -e "  ${CYAN}→${NC} $1"
}

print_success() {
    echo -e "  ${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "  ${RED}✗${NC} $1"
}

print_warning() {
    echo -e "  ${YELLOW}⚠${NC} $1"
}

# Funzione per verificare se un comando esiste
command_exists() {
    command -v "$1" &> /dev/null
}

# Directory corrente (dove è stato estratto/copiato il progetto)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

print_banner

echo -e "${BOLD}Questo script installerà tutte le dipendenze necessarie.${NC}"
echo -e "Directory progetto: ${CYAN}$PROJECT_DIR${NC}"
echo ""
read -p "Premi INVIO per continuare o CTRL+C per annullare..."

# ============================================================================
# STEP 1: Verifica prerequisiti di sistema
# ============================================================================
print_step "STEP 1: Verifica prerequisiti di sistema"

# Verifica Homebrew
if command_exists brew; then
    print_success "Homebrew installato: $(brew --version | head -n1)"
else
    print_warning "Homebrew non trovato. Installazione in corso..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Aggiungi Homebrew al PATH per questa sessione
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [[ -f "/usr/local/bin/brew" ]]; then
        eval "$(/usr/local/bin/brew shellenv)"
    fi
    print_success "Homebrew installato"
fi

# Verifica Node.js
if command_exists node; then
    NODE_VERSION=$(node -v)
    print_success "Node.js installato: $NODE_VERSION"
    
    # Verifica versione minima (18+)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | tr -d 'v')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        print_warning "Node.js versione $NODE_VERSION trovata, ma è raccomandata la v18+"
        read -p "Vuoi aggiornare Node.js? (s/n): " UPDATE_NODE
        if [[ "$UPDATE_NODE" =~ ^[Ss]$ ]]; then
            brew install node@20
            brew link --overwrite node@20
            print_success "Node.js aggiornato"
        fi
    fi
else
    print_warning "Node.js non trovato. Installazione in corso..."
    brew install node@20
    brew link --overwrite node@20
    print_success "Node.js installato: $(node -v)"
fi

# Verifica npm
if command_exists npm; then
    print_success "npm installato: $(npm -v)"
else
    print_error "npm non trovato (dovrebbe essere incluso con Node.js)"
    exit 1
fi

# Verifica PostgreSQL
if command_exists psql; then
    PSQL_VERSION=$(psql --version | awk '{print $3}')
    print_success "PostgreSQL installato: $PSQL_VERSION"
else
    print_warning "PostgreSQL non trovato."
    read -p "Vuoi installare PostgreSQL? (s/n): " INSTALL_PSQL
    if [[ "$INSTALL_PSQL" =~ ^[Ss]$ ]]; then
        brew install postgresql@16
        brew services start postgresql@16
        print_success "PostgreSQL installato e avviato"
    else
        print_warning "PostgreSQL non installato. Dovrai configurarlo manualmente."
    fi
fi

# ============================================================================
# STEP 2: Installazione dipendenze del progetto
# ============================================================================
print_step "STEP 2: Installazione dipendenze del progetto"

cd "$PROJECT_DIR"

# Dipendenze root (se presenti)
if [ -f "package.json" ]; then
    print_substep "Installazione dipendenze root..."
    npm install
    print_success "Dipendenze root installate"
fi

# Dipendenze Backend
print_substep "Installazione dipendenze backend..."
cd "$PROJECT_DIR/backend"
npm install
print_success "Dipendenze backend installate"

# Dipendenze Frontend
print_substep "Installazione dipendenze frontend..."
cd "$PROJECT_DIR/frontend"
npm install
print_success "Dipendenze frontend installate"

cd "$PROJECT_DIR"

# ============================================================================
# STEP 3: Configurazione ambiente
# ============================================================================
print_step "STEP 3: Configurazione ambiente"

# Crea file .env se non esiste
if [ ! -f "$PROJECT_DIR/backend/.env" ]; then
    if [ -f "$PROJECT_DIR/backend/.env.example" ]; then
        cp "$PROJECT_DIR/backend/.env.example" "$PROJECT_DIR/backend/.env"
        print_success "File .env creato da .env.example"
        print_warning "IMPORTANTE: Modifica backend/.env con le tue credenziali!"
    else
        print_warning "File .env.example non trovato. Creazione .env base..."
        cat > "$PROJECT_DIR/backend/.env" << 'ENVEOF'
# Database
DATABASE_URL="postgresql://localhost:5432/ecommerce_price_manager?schema=public"

# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key

# Frontend URL
FRONTEND_URL=http://localhost:5173
ENVEOF
        print_success "File .env base creato"
        print_warning "IMPORTANTE: Modifica backend/.env con le tue credenziali!"
    fi
else
    print_warning "File .env già esistente, non sovrascritto"
fi

# ============================================================================
# STEP 4: Configurazione Database
# ============================================================================
print_step "STEP 4: Configurazione Database"

read -p "Vuoi creare il database PostgreSQL 'ecommerce_price_manager'? (s/n): " CREATE_DB
if [[ "$CREATE_DB" =~ ^[Ss]$ ]]; then
    print_substep "Creazione database..."
    
    # Prova a creare il database
    if createdb ecommerce_price_manager 2>/dev/null; then
        print_success "Database 'ecommerce_price_manager' creato"
    else
        print_warning "Database potrebbe già esistere o PostgreSQL non è in esecuzione"
        print_substep "Provo ad avviare PostgreSQL..."
        brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null || true
        sleep 2
        createdb ecommerce_price_manager 2>/dev/null || print_warning "Creazione database fallita - potrebbe già esistere"
    fi
fi

# ============================================================================
# STEP 5: Generazione Prisma Client e Migrazioni
# ============================================================================
print_step "STEP 5: Setup Prisma ORM"

cd "$PROJECT_DIR/backend"

print_substep "Generazione Prisma Client..."
npm run db:generate 2>/dev/null || npx prisma generate
print_success "Prisma Client generato"

read -p "Vuoi eseguire le migrazioni del database? (s/n): " RUN_MIGRATIONS
if [[ "$RUN_MIGRATIONS" =~ ^[Ss]$ ]]; then
    print_substep "Esecuzione migrazioni..."
    npm run db:migrate 2>/dev/null || npx prisma migrate dev
    print_success "Migrazioni completate"
fi

cd "$PROJECT_DIR"

# ============================================================================
# STEP 6: Build dell'applicazione
# ============================================================================
print_step "STEP 6: Build dell'applicazione"

# Build Backend
print_substep "Build backend TypeScript..."
cd "$PROJECT_DIR/backend"
npm run build 2>/dev/null || npx tsc
print_success "Backend compilato"

# Build Frontend (opzionale per dev)
read -p "Vuoi eseguire la build di produzione del frontend? (s/n): " BUILD_FRONTEND
if [[ "$BUILD_FRONTEND" =~ ^[Ss]$ ]]; then
    print_substep "Build frontend..."
    cd "$PROJECT_DIR/frontend"
    npm run build
    print_success "Frontend compilato"
fi

cd "$PROJECT_DIR"

# ============================================================================
# STEP 7: Rendi eseguibili gli script
# ============================================================================
print_step "STEP 7: Configurazione permessi script"

chmod +x "$PROJECT_DIR"/*.sh 2>/dev/null || true
print_success "Permessi script configurati"

# ============================================================================
# COMPLETATO!
# ============================================================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}              ${BOLD}🎉 INSTALLAZIONE COMPLETATA! 🎉${NC}                       ${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}📋 Prossimi passi:${NC}"
echo ""
echo -e "   1. ${YELLOW}Configura le credenziali${NC} in ${CYAN}backend/.env${NC}"
echo "      - DATABASE_URL (se diversa dal default)"
echo "      - SHOPIFY_* (per sincronizzazione)"
echo "      - ICECAT_* (per arricchimento dati)"
echo "      - SMTP_* (per invio email)"
echo ""
echo -e "   2. ${YELLOW}Avvia l'applicazione:${NC}"
echo -e "      ${GREEN}cd $PROJECT_DIR${NC}"
echo -e "      ${GREEN}npm run dev${NC}"
echo ""
echo -e "   3. ${YELLOW}Oppure usa lo script di lancio:${NC}"
echo -e "      ${GREEN}./launch-app.sh${NC}"
echo ""
echo -e "${BOLD}🌐 URL dell'applicazione:${NC}"
echo -e "   Frontend: ${BLUE}http://localhost:5173${NC}"
echo -e "   Backend:  ${BLUE}http://localhost:3000${NC}"
echo ""
echo -e "${BOLD}📚 Comandi utili:${NC}"
echo -e "   ${CYAN}npm run dev${NC}           - Avvia in modalità sviluppo"
echo -e "   ${CYAN}npm run build${NC}         - Compila per produzione"
echo -e "   ${CYAN}cd backend && npm run db:studio${NC} - Apri Prisma Studio"
echo ""
echo -e "${MAGENTA}Buon lavoro con W[r]Digital Price Manager! 🚀${NC}"
echo ""
