#!/bin/bash
# ============================================================
# SETUP AUTOMATICO VPS ARUBA — Price Manager
# Ubuntu Server 22.04 LTS
# Esegui come root: bash setup-vps.sh
# ============================================================

set -e  # Esce immediatamente se un comando fallisce

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step() { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# ── Variabili configurabili ──────────────────────────────────
APP_DIR="/opt/price-manager"
DB_NAME="ecommerce_price_manager"
DB_USER="pricemanager"
DB_PASS="PriceManager2024!Aruba"
NODE_VERSION="20"
# ────────────────────────────────────────────────────────────

step "FASE 1 — Aggiornamento sistema"
apt-get update -y
apt-get upgrade -y
apt-get install -y curl wget git build-essential unzip rsync ufw
log "Sistema aggiornato"

step "FASE 2 — Installazione Node.js ${NODE_VERSION}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
fi
log "Node.js $(node --version) installato"
log "npm $(npm --version) installato"

step "FASE 3 — Installazione PostgreSQL 15"
if ! command -v psql &> /dev/null; then
    apt-get install -y postgresql postgresql-contrib
fi
systemctl enable postgresql
systemctl start postgresql
log "PostgreSQL avviato"

step "FASE 4 — Creazione Database e Utente"
sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME};"
sudo -u postgres psql -c "DROP USER IF EXISTS ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASS}';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql -c "ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};"
# Permessi sullo schema public (necessario per Prisma su PG 15)
sudo -u postgres psql -d ${DB_NAME} -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"
log "Database '${DB_NAME}' creato, utente '${DB_USER}' configurato"

step "FASE 5 — Installazione PM2 e Nginx"
npm install -g pm2 2>/dev/null
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx
log "PM2 $(pm2 --version) installato"
log "Nginx installato e avviato"

step "FASE 6 — Creazione cartella applicazione"
mkdir -p ${APP_DIR}
mkdir -p /opt/backups
log "Cartella ${APP_DIR} creata"

step "FASE 7 — Configurazione Firewall (UFW)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp  # temporaneo per test
ufw --force enable
log "Firewall configurato (SSH, HTTP, HTTPS, porta 3000)"

step "FASE 8 — Configurazione backup automatico DB"
mkdir -p /opt/backups
(crontab -l 2>/dev/null; echo "0 2 * * * pg_dump -U ${DB_USER} ${DB_NAME} > /opt/backups/db_\$(date +\%Y\%m\%d).sql 2>/dev/null") | crontab -
log "Backup automatico configurato (ogni giorno alle 02:00)"

step "FASE 9 — Setup Nginx placeholder"
cat > /etc/nginx/sites-available/price-manager << 'NGINX_CONF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    # Frontend (build statica React/Vite)
    root /opt/price-manager/frontend/dist;
    index index.html;

    # Aumenta timeout per operazioni lunghe (sync Shopify, import listini)
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;

    # Frontend SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        client_max_body_size 50M;
    }
}
NGINX_CONF

# Rimuovi default, attiva price-manager
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/price-manager /etc/nginx/sites-enabled/price-manager
nginx -t && systemctl reload nginx
log "Nginx configurato"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ SETUP VPS COMPLETATO CON SUCCESSO!             ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                                      ║${NC}"
echo -e "${GREEN}║  Database:  ${DB_NAME}       ║${NC}"
echo -e "${GREEN}║  DB User:   ${DB_USER}                    ║${NC}"
echo -e "${GREEN}║  DB Pass:   ${DB_PASS}      ║${NC}"
echo -e "${GREEN}║  App Dir:   ${APP_DIR}              ║${NC}"
echo -e "${GREEN}║                                                      ║${NC}"
echo -e "${GREEN}║  PROSSIMO PASSO:                                     ║${NC}"
echo -e "${GREEN}║  Dal tuo Mac, esegui:                                ║${NC}"
echo -e "${GREEN}║  bash deploy/sync-to-vps.sh                          ║${NC}"
echo -e "${GREEN}║                                                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
