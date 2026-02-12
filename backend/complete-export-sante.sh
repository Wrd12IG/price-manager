#!/bin/bash

# Script per completare l'export Shopify per Sante tramite API backend
# Il backend gestisce meglio le connessioni long-running

echo "🚀 Riavvio export Shopify per Sante tramite API backend..."
echo ""
echo "Backend URL: http://localhost:3000"
echo "Utente: Sante (ID: 2)"
echo ""

# Nota: L'endpoint prepare dovrebbe essere protetto, ma per testing locale va bene
# In produzione bisognerebbe usare autenticazione

# Verifica che il backend sia attivo
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "❌ Backend non raggiungibile su porta 3000"
    echo "   Verifica che il backend sia avviato con: npm run dev"
    exit 1
fi

echo "✅ Backend attivo"
echo ""
echo "📤 Avvio preparazione export (potrebbe richiedere diversi minuti)..."
echo ""

# Chiama l'API di preparazione export
# Nota: Questo endpoint processa i prodotti in modo ottimizzato
response=$(curl -s -w "\n%{http_code}" http://localhost:3000/api/shopify/export/prepare?utenteId=2)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "HTTP Status: $http_code"
echo ""

if [ "$http_code" = "200" ]; then
    echo "✅ Export preparato con successo!"
    echo ""
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
    echo ""
    echo "📊 Verifica stato con:"
    echo "   curl http://localhost:3000/api/shopify/export/stats?utenteId=2 | jq"
    echo ""
    echo "🚀 Prossimo step: Sincronizza con Shopify"
    echo "   Vai su dashboard → Shopify → Sincronizza"
else
    echo "⚠️  Risposta API: $http_code"
    echo "$body"
fi
