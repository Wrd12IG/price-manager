#!/bin/bash

# Exit on error
set -e

echo "🚀 Inizio creazione pacchetto installazione Windows..."

# Clean up previous builds
rm -rf installer
rm -rf installer.zip
rm -rf frontend/dist
rm -rf backend/dist

# Build Frontend
echo "📦 Building Frontend..."
cd frontend
# Ensure dependencies (optional if already there)
# npm install 
npm run build
cd ..

# Build Backend
echo "📦 Building Backend..."
cd backend
# npm install
npm run build
cd ..

# Create directory structure
echo "📂 Creating directory structure..."
mkdir -p installer/server
mkdir -p installer/server/public
mkdir -p installer/server/dist
mkdir -p installer/server/prisma

# Copy Backend Files
echo "COPYING Backend files..."
cp -r backend/dist/* installer/server/dist/
cp backend/package.json installer/server/
cp -r backend/prisma/schema.prisma installer/server/prisma/
cp -r backend/prisma/dev.db installer/server/prisma/
cp -r backend/prisma/migrations installer/server/prisma/ 2>/dev/null || true

# Copy Frontend Files
echo "COPYING Frontend files..."
cp -r frontend/dist/* installer/server/public/

# Create .env
echo "📝 Creating .env..."
cat > installer/server/.env << EOL
PORT=3000
NODE_ENV=production
# Update this if using a different secret
JWT_SECRET=changeme_production_secret_key_12345
# Database path relative to prisma schema or absolute
DATABASE_URL="file:./dev.db"
# Since frontend is served by backend, origin is self
FRONTEND_URL=http://localhost:3000
EOL

# Create INSTALL.bat
echo "📝 Creating INSTALL.bat..."
cat > installer/INSTALL.bat << EOL
@echo off
echo ==========================================
echo      INSTALLAZIONE PRICE MANAGER
echo ==========================================
echo.
echo 1. Controllo Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRORE: Node.js non e' installato!
    echo Scaricalo e installalo da https://nodejs.org/
    pause
    exit /b
)
echo Node.js trovato.
echo.

echo 2. Installazione dipendenze server...
cd server
call npm install --production --no-audit
if %errorlevel% neq 0 (
    echo ERRORE durante l'installazione delle dipendenze.
    pause
    exit /b
)

echo.
echo 3. Configurazione Database...
call npx prisma generate
if %errorlevel% neq 0 (
    echo ERRORE durante la generazione del client Prisma.
    pause
    exit /b
)
cd ..

echo.
echo ==========================================
echo      INSTALLAZIONE COMPLETATA!
echo ==========================================
echo.
echo Ora puoi avviare l'applicazione con START.bat
echo.
pause
EOL

# Create START.bat
echo "📝 Creating START.bat..."
cat > installer/START.bat << EOL
@echo off
echo ==========================================
echo      AVVIO PRICE MANAGER
echo ==========================================
echo.
cd server
echo Avvio del server in corso...
echo L'applicazione sara' accessibile a: http://localhost:3000
echo.
echo NON CHIUDERE QUESTA FINESTRA
echo.
rem Avvia il server
set NODE_ENV=production
node dist/index.js
pause
EOL

# Create README
cat > installer/LEGGIMI.txt << EOL
ISTRUZIONI DI INSTALLAZIONE

1. Requisiti:
   - Windows 10/11 o Server
   - Node.js installato (versione 18 o superiore consigliata)

2. Installazione:
   - Estrarre tutto il contenuto dello zip in una cartella (es. C:\PriceManager)
   - Fare doppio click su INSTALL.bat
   - Attendere il completamento dell'installazione delle dipendenze

3. Avvio:
   - Fare doppio click su START.bat
   - Aprire il browser e andare su http://localhost:3000

NOTE:
- Il database e' incluso (dev.db) con tutti i dati attuali.
- Per cambiare porta o impostazioni, modificare il file server/.env
EOL

# Zip everything
echo "🤐 Zipping package..."
cd installer
zip -r ../ecommerce_installer.zip .
cd ..

echo "✅ PACCHETTO CREATO CON SUCCESSO: ecommerce_installer.zip"
