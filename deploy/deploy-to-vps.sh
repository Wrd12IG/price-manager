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

# Crea archivio del backend
echo "📦 Creazione archivio backend..."
cd "$(dirname "$0")/.."
tar -czf /tmp/backend.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='prisma/dev.db' \
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

# Estrai archivio
tar -xzf /tmp/backend.tar.gz
mv backend/* . 2>/dev/null || true
rm -rf backend /tmp/backend.tar.gz

# Installa dipendenze
npm install --production

# Genera Prisma client
npx prisma generate

# Riavvia applicazione
pm2 restart price-manager 2>/dev/null || pm2 start npm --name "price-manager" -- start

echo "✅ Deploy completato!"
REMOTE

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "   ✅ DEPLOY COMPLETATO!"
echo "   Backend disponibile su: http://${VPS_IP}:3001"
echo "═══════════════════════════════════════════════════════════"
