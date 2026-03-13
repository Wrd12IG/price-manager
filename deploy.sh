#!/bin/bash

# Configuration
SERVER="root@31.14.139.249"
REMOTE_PATH="/opt/price-manager/backend"

echo "🚀 Starting Deployment to $SERVER..."

# 1. Build Frontend
echo "📦 Building Frontend..."
cd frontend
npm run build
cd ..

# 2. Build Backend
echo "📦 Building Backend..."
cd backend
npm run build
# Sincronizza build frontend nella cartella public del backend per il deploy
echo "📂 Preparazione cartella public..."
rm -rf public/*
mkdir -p public
cp -r ../frontend/dist/* public/
cd ..

# 3. Deploy everything via rsync
echo "📤 Syncing to Server..."
rsync -avz --delete \
    --exclude "node_modules" \
    --exclude ".env" \
    --exclude "prisma/*.db" \
    --exclude "src" \
    --exclude "*.ts" \
    --exclude "*.tsx" \
    backend/ $SERVER:$REMOTE_PATH/


# 5. Remote Post-Deploy Actions
echo "⚙️  Running Remote Updates..."
ssh $SERVER "cd $REMOTE_PATH && npm install --production --no-audit && npx prisma generate && pm2 restart price-manager-backend"

echo "✅ DEPLOYMENT COMPLETE!"
echo "Check at: http://31.14.139.249"
