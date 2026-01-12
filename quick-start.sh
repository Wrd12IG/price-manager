#!/bin/bash

# 🚀 Quick Start Script - E-commerce Price Manager
# Questo script ti guida attraverso il setup iniziale

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   E-commerce Price Manager - Quick Start                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funzione per stampare messaggi
print_step() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Verifica prerequisiti
print_step "Verifica prerequisiti..."

# Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_success "Node.js installato: $NODE_VERSION"
else
    print_error "Node.js non trovato! Installalo da https://nodejs.org/"
    exit 1
fi

# PostgreSQL
if command -v psql &> /dev/null; then
    PSQL_VERSION=$(psql --version | awk '{print $3}')
    print_success "PostgreSQL installato: $PSQL_VERSION"
else
    print_warning "PostgreSQL non trovato. Assicurati di averlo installato."
fi

echo ""

# 2. Installazione dipendenze
print_step "Installazione dipendenze..."
npm install
if [ $? -eq 0 ]; then
    print_success "Dipendenze installate"
else
    print_error "Errore nell'installazione delle dipendenze"
    exit 1
fi

echo ""

# 3. Setup Backend
print_step "Setup Backend..."

cd backend

# Copia .env se non esiste
if [ ! -f .env ]; then
    cp .env.example .env
    print_success "File .env creato"
    print_warning "IMPORTANTE: Modifica backend/.env con le tue credenziali!"
else
    print_warning ".env già esistente, non sovrascritto"
fi

echo ""

# 4. Chiedi se creare il database
read -p "Vuoi creare il database PostgreSQL ora? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_step "Creazione database..."
    
    read -p "Nome database (default: ecommerce_price_manager): " DB_NAME
    DB_NAME=${DB_NAME:-ecommerce_price_manager}
    
    createdb $DB_NAME 2>/dev/null
    if [ $? -eq 0 ]; then
        print_success "Database '$DB_NAME' creato"
    else
        print_warning "Database potrebbe già esistere o errore nella creazione"
    fi
fi

echo ""

# 5. Genera Prisma Client
print_step "Generazione Prisma Client..."
npm run db:generate
if [ $? -eq 0 ]; then
    print_success "Prisma Client generato"
else
    print_error "Errore nella generazione Prisma Client"
fi

echo ""

# 6. Chiedi se eseguire migrazioni
read -p "Vuoi eseguire le migrazioni del database ora? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_step "Esecuzione migrazioni..."
    npm run db:migrate
    if [ $? -eq 0 ]; then
        print_success "Migrazioni completate"
    else
        print_error "Errore nelle migrazioni"
        print_warning "Verifica la connessione al database in .env"
    fi
fi

cd ..

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    Setup Completato! 🎉                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Prossimi passi:"
echo ""
echo "1. Configura le credenziali in backend/.env"
echo "   - DATABASE_URL"
echo "   - JWT_SECRET"
echo "   - ENCRYPTION_KEY"
echo ""
echo "2. Avvia l'applicazione:"
echo "   ${GREEN}npm run dev${NC}"
echo ""
echo "3. Apri il browser:"
echo "   Frontend: ${BLUE}http://localhost:5173${NC}"
echo "   Backend:  ${BLUE}http://localhost:3000${NC}"
echo ""
echo "4. (Opzionale) Apri Prisma Studio per gestire il database:"
echo "   ${GREEN}cd backend && npm run db:studio${NC}"
echo ""
echo "📚 Documentazione:"
echo "   - Setup:    docs/SETUP.md"
echo "   - API:      docs/API.md"
echo "   - Workflow: docs/WORKFLOW.md"
echo ""
echo "🎯 Buon lavoro!"
echo ""
