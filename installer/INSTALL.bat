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
