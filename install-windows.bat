@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: ╔════════════════════════════════════════════════════════════════════════════╗
:: ║         E-commerce Price Manager - Installazione per Windows               ║
:: ║         W[r]Digital - Script di Setup Automatico                           ║
:: ╚════════════════════════════════════════════════════════════════════════════╝

title W[r]Digital Price Manager - Installazione

:: Colori (usando ANSI escape codes)
set "GREEN=[32m"
set "RED=[31m"
set "YELLOW=[33m"
set "BLUE=[34m"
set "CYAN=[36m"
set "RESET=[0m"

:: Directory del progetto
set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

echo.
echo %CYAN%╔════════════════════════════════════════════════════════════════════╗%RESET%
echo %CYAN%║%RESET%  W[r]Digital - E-commerce Price Manager                          %CYAN%║%RESET%
echo %CYAN%║%RESET%  Installazione Automatica per Windows                            %CYAN%║%RESET%
echo %CYAN%╚════════════════════════════════════════════════════════════════════╝%RESET%
echo.
echo Directory progetto: %CYAN%%PROJECT_DIR%%RESET%
echo.
echo Questo script installera' tutte le dipendenze necessarie.
echo.
pause

:: ============================================================================
:: STEP 1: Verifica prerequisiti di sistema
:: ============================================================================
echo.
echo %BLUE%▶%RESET% STEP 1: Verifica prerequisiti di sistema
echo.

:: Verifica Node.js
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
    echo   %GREEN%✓%RESET% Node.js installato: !NODE_VERSION!
) else (
    echo   %RED%✗%RESET% Node.js NON trovato!
    echo.
    echo   Per favore installa Node.js da: https://nodejs.org/
    echo   Scarica la versione LTS ^(20.x o superiore^)
    echo.
    echo   Dopo l'installazione, riavvia questo script.
    echo.
    pause
    exit /b 1
)

:: Verifica npm
where npm >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
    echo   %GREEN%✓%RESET% npm installato: !NPM_VERSION!
) else (
    echo   %RED%✗%RESET% npm NON trovato ^(dovrebbe essere incluso con Node.js^)
    pause
    exit /b 1
)

:: Verifica PostgreSQL (opzionale)
where psql >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   %GREEN%✓%RESET% PostgreSQL trovato nel PATH
) else (
    echo   %YELLOW%⚠%RESET% PostgreSQL non trovato nel PATH
    echo     Se hai PostgreSQL installato, aggiungilo al PATH di sistema
    echo     Altrimenti, installalo da: https://www.postgresql.org/download/windows/
)

:: ============================================================================
:: STEP 2: Installazione dipendenze del progetto
:: ============================================================================
echo.
echo %BLUE%▶%RESET% STEP 2: Installazione dipendenze del progetto
echo.

cd /d "%PROJECT_DIR%"

:: Dipendenze root (se presenti)
if exist "package.json" (
    echo   → Installazione dipendenze root...
    call npm install
    if %ERRORLEVEL% EQU 0 (
        echo   %GREEN%✓%RESET% Dipendenze root installate
    ) else (
        echo   %RED%✗%RESET% Errore installazione dipendenze root
    )
)

:: Dipendenze Backend
echo   → Installazione dipendenze backend...
cd /d "%PROJECT_DIR%\backend"
call npm install
if %ERRORLEVEL% EQU 0 (
    echo   %GREEN%✓%RESET% Dipendenze backend installate
) else (
    echo   %RED%✗%RESET% Errore installazione dipendenze backend
    pause
    exit /b 1
)

:: Dipendenze Frontend
echo   → Installazione dipendenze frontend...
cd /d "%PROJECT_DIR%\frontend"
call npm install
if %ERRORLEVEL% EQU 0 (
    echo   %GREEN%✓%RESET% Dipendenze frontend installate
) else (
    echo   %RED%✗%RESET% Errore installazione dipendenze frontend
    pause
    exit /b 1
)

cd /d "%PROJECT_DIR%"

:: ============================================================================
:: STEP 3: Configurazione ambiente
:: ============================================================================
echo.
echo %BLUE%▶%RESET% STEP 3: Configurazione ambiente
echo.

:: Crea file .env se non esiste
if not exist "%PROJECT_DIR%\backend\.env" (
    if exist "%PROJECT_DIR%\backend\.env.example" (
        copy "%PROJECT_DIR%\backend\.env.example" "%PROJECT_DIR%\backend\.env" >nul
        echo   %GREEN%✓%RESET% File .env creato da .env.example
        echo   %YELLOW%⚠%RESET% IMPORTANTE: Modifica backend\.env con le tue credenziali!
    ) else (
        echo   %YELLOW%⚠%RESET% File .env.example non trovato. Creazione .env base...
        (
            echo # Database
            echo DATABASE_URL="postgresql://localhost:5432/ecommerce_price_manager?schema=public"
            echo.
            echo # Server
            echo PORT=3000
            echo NODE_ENV=development
            echo.
            echo # JWT
            echo JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
            echo JWT_EXPIRES_IN=7d
            echo.
            echo # Encryption
            echo ENCRYPTION_KEY=your-32-character-encryption-key
            echo.
            echo # Frontend URL
            echo FRONTEND_URL=http://localhost:5173
        ) > "%PROJECT_DIR%\backend\.env"
        echo   %GREEN%✓%RESET% File .env base creato
        echo   %YELLOW%⚠%RESET% IMPORTANTE: Modifica backend\.env con le tue credenziali!
    )
) else (
    echo   %YELLOW%⚠%RESET% File .env gia' esistente, non sovrascritto
)

:: ============================================================================
:: STEP 4: Setup Prisma ORM
:: ============================================================================
echo.
echo %BLUE%▶%RESET% STEP 4: Setup Prisma ORM
echo.

cd /d "%PROJECT_DIR%\backend"

echo   → Generazione Prisma Client...
call npx prisma generate
if %ERRORLEVEL% EQU 0 (
    echo   %GREEN%✓%RESET% Prisma Client generato
) else (
    echo   %RED%✗%RESET% Errore generazione Prisma Client
)

echo.
set /p RUN_MIGRATIONS="Vuoi eseguire le migrazioni del database? (s/n): "
if /i "!RUN_MIGRATIONS!"=="s" (
    echo   → Esecuzione migrazioni...
    call npx prisma migrate dev
    if %ERRORLEVEL% EQU 0 (
        echo   %GREEN%✓%RESET% Migrazioni completate
    ) else (
        echo   %YELLOW%⚠%RESET% Migrazioni fallite - verifica la connessione al database
    )
)

cd /d "%PROJECT_DIR%"

:: ============================================================================
:: STEP 5: Build dell'applicazione
:: ============================================================================
echo.
echo %BLUE%▶%RESET% STEP 5: Build dell'applicazione
echo.

:: Build Backend
echo   → Build backend TypeScript...
cd /d "%PROJECT_DIR%\backend"
call npx tsc
if %ERRORLEVEL% EQU 0 (
    echo   %GREEN%✓%RESET% Backend compilato
) else (
    echo   %YELLOW%⚠%RESET% Build backend fallita - potrebbe esserci un errore nel codice
)

cd /d "%PROJECT_DIR%"

:: ============================================================================
:: COMPLETATO!
:: ============================================================================
echo.
echo %GREEN%╔════════════════════════════════════════════════════════════════════╗%RESET%
echo %GREEN%║%RESET%              🎉 INSTALLAZIONE COMPLETATA! 🎉                       %GREEN%║%RESET%
echo %GREEN%╚════════════════════════════════════════════════════════════════════╝%RESET%
echo.
echo %CYAN%Prossimi passi:%RESET%
echo.
echo    1. Configura le credenziali in backend\.env
echo       - DATABASE_URL ^(se diversa dal default^)
echo       - SHOPIFY_* ^(per sincronizzazione^)
echo       - ICECAT_* ^(per arricchimento dati^)
echo       - SMTP_* ^(per invio email^)
echo.
echo    2. Avvia l'applicazione:
echo       %GREEN%cd %PROJECT_DIR%%RESET%
echo       %GREEN%npm run dev%RESET%
echo.
echo    3. Oppure usa lo script di avvio:
echo       %GREEN%start-app.bat%RESET%
echo.
echo %CYAN%URL dell'applicazione:%RESET%
echo    Frontend: %BLUE%http://localhost:5173%RESET%
echo    Backend:  %BLUE%http://localhost:3000%RESET%
echo.
echo %CYAN%Comandi utili:%RESET%
echo    npm run dev           - Avvia in modalita' sviluppo
echo    npm run build         - Compila per produzione
echo    cd backend ^&^& npx prisma studio - Apri Prisma Studio
echo.
echo Buon lavoro con W[r]Digital Price Manager! 🚀
echo.
pause
