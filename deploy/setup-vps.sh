#!/bin/bash
# ============================================================
# SCRIPT DI SETUP VPS PER PRICE MANAGER
# Esegui questo script sul VPS Aruba dopo il primo accesso
# ============================================================

set -e

echo "═══════════════════════════════════════════════════════════"
echo "   W[r]Digital Price Manager - Setup VPS"
echo "═══════════════════════════════════════════════════════════"

# Aggiorna il sistema
echo "📦 Aggiornamento sistema..."
apt update && apt upgrade -y

# Installa dipendenze base
echo "📦 Installazione dipendenze..."
apt install -y curl wget git build-essential nginx certbot python3-certbot-nginx

# Installa Node.js 20 LTS
echo "📦 Installazione Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verifica installazione
echo "✅ Node.js: $(node -v)"
echo "✅ NPM: $(npm -v)"

# Installa PM2 per gestione processi
echo "📦 Installazione PM2..."
npm install -g pm2

# Crea directory app
echo "📁 Creazione directory..."
mkdir -p /var/www/price-manager
cd /var/www/price-manager

# Clona o copia il progetto (placeholder - lo faremo dopo)
echo "📁 Directory pronta: /var/www/price-manager"

# Configura firewall
echo "🔒 Configurazione firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw allow 3001/tcp  # Backend API
ufw --force enable

# Configura Nginx come reverse proxy
echo "🌐 Configurazione Nginx..."
cat > /etc/nginx/sites-available/price-manager << 'NGINX'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3001;
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
    }
}
NGINX

ln -sf /etc/nginx/sites-available/price-manager /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "   ✅ SETUP BASE COMPLETATO!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "   Prossimi passi:"
echo "   1. Carica il codice backend in /var/www/price-manager"
echo "   2. Configura le variabili d'ambiente (.env)"
echo "   3. Avvia con: pm2 start npm --name 'price-manager' -- start"
echo ""
