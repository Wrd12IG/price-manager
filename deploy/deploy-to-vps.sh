#!/bin/bash
# ============================================================
# SCRIPT DI DEPLOY BACKEND SU VPS
# Esegui dal Mac: ./deploy/deploy-to-vps.sh
# ============================================================

VPS_IP="31.14.139.249"
VPS_USER="root"
APP_DIR="/opt/price-manager/backend"
# NOTA: Consigliato l'uso di deploy/sync-to-vps.sh per deploy completi.


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

# 2. Build Backend
echo "📦 Building Backend..."
cd "$BACKEND_DIR"
npm install
npm run build
cd ..

# 3. Copia l'output della build del frontend nella cartella public del backend
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
cd /opt/price-manager/backend

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

# Genera Prisma client e aggiorna schema DB
npx prisma generate
npx prisma db push --accept-data-loss

# Riavvia applicazione
echo "🔄 Riavvio PM2..."
pm2 restart price-manager-backend --update-env || pm2 start dist/index.js --name "price-manager-backend"

echo "✅ Deploy completato sul server!"
REMOTE

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "   ✅ DEPLOY COMPLETATO!"
echo "   App disponibile su: http://${VPS_IP}"
echo "═══════════════════════════════════════════════════════════"
