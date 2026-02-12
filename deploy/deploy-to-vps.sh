#!/bin/bash
# ============================================================
# SCRIPT DI DEPLOY BACKEND SU VPS
# Esegui dal Mac: ./deploy/deploy-to-vps.sh
# ============================================================

VPS_IP="5.249.149.97"
VPS_USER="root"
APP_DIR="/var/www/price-manager"

echo "═══════════════════════════════════════════════════════════"
echo "   Deploy Price Manager Backend su VPS"
echo "═══════════════════════════════════════════════════════════"

# 1. Build Frontend
echo "📦 Building Frontend..."
FRONTEND_DIR="$(dirname "$0")/../frontend"
BACKEND_DIR="$(dirname "$0")/../backend"

cd "$FRONTEND_DIR"
npm install
npm run build
cd ..

# 2. Copia l'output della build del frontend nella cartella public del backend
echo "🚚 Copying frontend assets to backend/public..."
mkdir -p "$BACKEND_DIR/public"
rm -rf "$BACKEND_DIR/public"/*
cp -r "$FRONTEND_DIR/dist"/* "$BACKEND_DIR/public/"

# 3. Creazione archivio del backend (che ora contiene il frontend in public/)
echo "📦 Creazione archivio completo..."
cd "$BACKEND_DIR/.."
tar -czf /tmp/backend.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='prisma/dev.db' \
    --exclude='.env' \
    --exclude='*.log' \
    backend/

# Upload su VPS
echo "📤 Upload su VPS..."
scp /tmp/backend.tar.gz ${VPS_USER}@${VPS_IP}:/tmp/

# Deploy sul VPS
echo "🚀 Deploy in corso..."
ssh ${VPS_USER}@${VPS_IP} << 'REMOTE'
set -e
cd /var/www/price-manager

# Mostra info per debug
echo "📂 Directory attuale: $(pwd)"
echo "⚙️ PM2 Status:"
pm2 status

# Pulizia e Estrazione
echo "🧹 Pulizia versioni precedenti..."
rm -rf public dist
tar -xzf /tmp/backend.tar.gz
mv backend/* . 2>/dev/null || true
rm -rf backend /tmp/backend.tar.gz

# Verifica cartella public
echo "📁 Contenuto cartella public/assets:"
ls -la public/assets || echo "⚠️ Cartella assets non trovata!"

# Installa dipendenze
npm install --production

# Genera Prisma client
npx prisma generate

# Riavvia applicazione
echo "🔄 Riavvio PM2..."
pm2 restart price-manager --update-env || pm2 start npm --name "price-manager" -- start

echo "✅ Deploy completato sul server!"
REMOTE

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "   ✅ DEPLOY COMPLETATO!"
echo "   Backend disponibile su: http://${VPS_IP}:3001"
echo "═══════════════════════════════════════════════════════════"
