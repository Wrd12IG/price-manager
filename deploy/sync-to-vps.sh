#!/bin/bash
# ============================================================
# SYNC CODICE DAL MAC ALLA VPS ARUBA (IPv4)
# Esegui dal tuo Mac: bash deploy/sync-to-vps.sh
# ============================================================

VPS_IP="31.14.139.249"
VPS_USER="root"
VPS_PASS="<YOUR_VPS_PASSWORD>"
APP_DIR="/opt/price-manager"
LOCAL_DIR="/Users/wrdigital/.gemini/antigravity/scratch/ecommerce-price-manager"
SSHPASS_BIN="$HOME/sshpass"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
step() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Verifica sshpass
if [ ! -f "$SSHPASS_BIN" ]; then
    error "sshpass non trovato in $SSHPASS_BIN. Esegui prima il setup dei tool locali."
fi

step "Sincronizzazione Backend"
$SSHPASS_BIN -p "$VPS_PASS" rsync -avz --progress \
  -e "ssh -o StrictHostKeyChecking=no" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='dev.db' \
  --exclude='*.log' \
  --exclude='shopify_export.csv' \
  --exclude='shopify_clean_sync.log' \
  "${LOCAL_DIR}/backend/" \
  "${VPS_USER}@${VPS_IP}:${APP_DIR}/backend/"
log "Backend sincronizzato"

step "Sincronizzazione Frontend"
$SSHPASS_BIN -p "$VPS_PASS" rsync -avz --progress \
  -e "ssh -o StrictHostKeyChecking=no" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  "${LOCAL_DIR}/frontend/" \
  "${VPS_USER}@${VPS_IP}:${APP_DIR}/frontend/"
log "Frontend sincronizzato"

step "Creazione .env sulla VPS"
$SSHPASS_BIN -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "cat > ${APP_DIR}/backend/.env" << 'EOF'
# ============================================
# VPS ARUBA — Price Manager
# Database PostgreSQL LOCALE
# ============================================

DATABASE_URL="postgresql://<USERNAME>:<PASSWORD>@localhost:5432/<DATABASE>"
DIRECT_URL="postgresql://<USERNAME>:<PASSWORD>@localhost:5432/<DATABASE>"

PORT=3000
NODE_ENV=production

JWT_SECRET="<YOUR_JWT_SECRET>"
ENCRYPTION_KEY="<YOUR_ENCRYPTION_KEY>"

LOG_LEVEL=info

GEMINI_API_KEY="<YOUR_GEMINI_API_KEY>"
OPENAI_API_KEY="<YOUR_OPENAI_API_KEY>"
GOOGLE_AI_API_KEY="<YOUR_GOOGLE_AI_API_KEY>"

SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER="<YOUR_SMTP_USER>"
SMTP_PASS="<YOUR_SMTP_PASSWORD>"
SMTP_SECURE=false
SMTP_FROM="Price Manager <price_manager@wrdigital.it>"

ICECAT_USERNAME=Wrdigital
ICECAT_PASSWORD=

SHOPIFY_SHOP_URL=2yv1ba-4e.myshopify.com
SHOPIFY_ACCESS_TOKEN=
EOF
log ".env creato sulla VPS"

step "Installazione dipendenze e build backend sulla VPS"
$SSHPASS_BIN -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "cd ${APP_DIR}/backend && npm install --production=false && npm run build"
log "Backend buildato con successo"

step "Applicazione schema database (Prisma)"
$SSHPASS_BIN -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "cd ${APP_DIR}/backend && npx prisma db push --accept-data-loss"
log "Schema database aggiornato"

step "Creazione/Aggiornamento utente Admin"
$SSHPASS_BIN -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "cd ${APP_DIR}/backend && node -e \"
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('Admin2024!', 12);
  const user = await prisma.utente.upsert({
    where: { email: 'sante.dormio@gmail.com' },
    update: { passwordHash: hash, attivo: true },
    create: { email: 'sante.dormio@gmail.com', passwordHash: hash, nome: 'Sante', cognome: 'Dormio', ruolo: 'admin', attivo: true }
  });
  console.log('✅ Utente admin Sante configurato correttamente.');
  await prisma.\\\$disconnect();
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
\""
log "Utente admin configurato"

step "Installazione dipendenze e build frontend sulla VPS"
$SSHPASS_BIN -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "cd ${APP_DIR}/frontend && npm install && npm run build"
log "Frontend buildato con successo"

step "Avvio/Riavvio Backend con PM2"
$SSHPASS_BIN -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "
  pm2 delete price-manager-backend 2>/dev/null || true
  pm2 start ${APP_DIR}/backend/dist/index.js \
    --name 'price-manager-backend' \
    --max-memory-restart 512M \
    --env production
  pm2 save
  pm2 startup | tail -1 | bash || true
"
log "Servizio backend avviato con PM2"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   🚀 DEPLOY SU ARUBA COMPLETATO!                        ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║  URL:     http://${VPS_IP}                      ║${NC}"
echo -e "${GREEN}║  Admin:   sante.dormio@gmail.com                         ║${NC}"
echo -e "${GREEN}║  Pass:    Admin2024!                                     ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
