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
echo "📤 Clearing remote assets and pushing Frontend to Server..."
ssh $SERVER "rm -rf $REMOTE_PATH/public/assets/* && mkdir -p $REMOTE_PATH/public/assets"
# Copia index.html
cat frontend/dist/index.html | ssh $SERVER "cat > $REMOTE_PATH/public/index.html"
# Copia ogni asset (css + js) uno per uno in modo affidabile
for f in frontend/dist/assets/*; do
    BASENAME=$(basename "$f")
    echo "   → Upload $BASENAME"
    cat "$f" | ssh $SERVER "cat > $REMOTE_PATH/public/assets/$BASENAME"
done
echo "   ✅ Frontend assets caricati"

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
