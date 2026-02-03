#!/bin/bash
#
# Script per applicare il fix database timeout
# Richiede accesso superuser PostgreSQL
#

echo "======================================"
echo "FIX DATABASE TIMEOUT - Price Manager"
echo "======================================"
echo ""

# Recupera il nome del database dalla connection string
DB_URL="${DATABASE_URL}"

if [ -z "$DB_URL" ]; then
    echo "❌ Variabile DATABASE_URL non trovata"
    echo "Carica il file .env:"
    source .env 2>/dev/null || echo "File .env non trovato"
    DB_URL="${DATABASE_URL}"
fi

# Estrai nome database, host, user, password dalla connection string
# Format: postgresql://user:password@host:port/database
DB_NAME=$(echo "$DB_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$DB_URL" | sed -n 's/.*:\/\/\([^:]*\).*/\1/p')
DB_HOST=$(echo "$DB_URL" | sed -n 's/.*@\([^:]*\).*/\1/p')
DB_PORT=$(echo "$DB_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

echo "📊 Configurazione database:"
echo "   Host: ${DB_HOST:-localhost}"
echo "   Port: ${DB_PORT:-5432}"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""

# Verifica se psql è disponibile
if ! command -v psql &> /dev/null; then
    echo "❌ psql non trovato. Installa PostgreSQL client."
    echo ""
    echo "Su macOS: brew install postgresql"
    echo "Su Ubuntu: sudo apt-get install postgresql-client"
    exit 1
fi

echo "🔧 Applicazione fix timeout..."
echo ""

# Esegui il comando SQL
psql "$DB_URL" -c "ALTER DATABASE \"$DB_NAME\" SET statement_timeout = '30min';" 

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Timeout database impostato a 30 minuti"
    echo ""
    
    # Verifica
    echo "🔍 Verifica configurazione:"
    psql "$DB_URL" -c "SHOW statement_timeout;"
    
    echo ""
    echo "======================================"
    echo "✅ FIX COMPLETATO CON SUCCESSO"
    echo "======================================"
    echo ""
    echo "Il workflow non andrà più in timeout durante l'import listini."
    echo "Puoi testare con: npm run test:workflow"
else
    echo ""
    echo "❌ Errore applicazione fix"
    echo ""
    echo "📝 ESEGUI MANUALMENTE:"
    echo ""
    echo "psql -U postgres -c \"ALTER DATABASE \\\"$DB_NAME\\\" SET statement_timeout = '30min';\""
    echo ""
    exit 1
fi
