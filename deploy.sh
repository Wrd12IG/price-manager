#!/bin/bash

# Configuration
SERVER="root@5.249.149.97"
REMOTE_PATH="/var/www/price-manager"

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
cd ..

# 3. Deploy Frontend Static Files
echo "📤 Syncing Frontend to Server..."
rsync -avz --delete frontend/dist/ $SERVER:$REMOTE_PATH/public/

# 4. Deploy Backend Source (excluding node_modules and env)
echo "📤 Syncing Backend to Server..."
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
ssh $SERVER "cd $REMOTE_PATH && npm install --production --no-audit && npx prisma generate && pm2 restart price-manager"

echo "✅ DEPLOYMENT COMPLETE!"
echo "Check at: https://pricemanager.wrdigital.it"
