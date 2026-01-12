@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

:: ============================================================================
::         E-COMMERCE PRICE MANAGER - INSTALLAZIONE AUTOMATICA (Windows)
:: ============================================================================
:: Questo script installa tutto il necessario per far funzionare l'applicazione.
:: Basta fare doppio clic per avviare l'installazione.
:: ============================================================================

title E-commerce Price Manager - Installazione

:: Colori
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "BLUE=[94m"
set "CYAN=[96m"
set "NC=[0m"

:: Directory
set "INSTALL_DIR=%USERPROFILE%\EcommercePriceManager"
set "SCRIPT_DIR=%~dp0"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "DESKTOP_DIR=%USERPROFILE%\Desktop"

:: Porte
set "BACKEND_PORT=3000"
set "FRONTEND_PORT=5173"

echo.
echo %CYAN%========================================================================%NC%
echo %CYAN%   E-commerce Price Manager - Installazione Automatica%NC%
echo %CYAN%   W[r]Digital%NC%
echo %CYAN%========================================================================%NC%
echo.

:: ============================================================================
:: STEP 1: Verifica Node.js
:: ============================================================================
echo %YELLOW%^> Verifico Node.js...%NC%

where node >nul 2>&1
if %ERRORLEVEL%==0 (
    for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
    echo %GREEN%√ Node.js !NODE_VERSION! trovato!%NC%
) else (
    echo %RED%X Node.js non trovato!%NC%
    echo.
    echo %YELLOW%Node.js e' necessario per eseguire l'applicazione.%NC%
    echo Scarica e installa Node.js LTS da: https://nodejs.org/
    echo.
    echo Vuoi aprire la pagina di download? (S/N^)
    set /p "response="
    if /i "!response!"=="S" start https://nodejs.org/
    echo.
    echo Dopo aver installato Node.js, RIAVVIA questo script.
    pause
    exit /b 1
)

:: ============================================================================
:: STEP 2: Verifica PostgreSQL
:: ============================================================================
echo %YELLOW%^> Verifico PostgreSQL...%NC%

where psql >nul 2>&1
if %ERRORLEVEL%==0 (
    echo %GREEN%√ PostgreSQL trovato!%NC%
) else (
    echo %RED%X PostgreSQL non trovato!%NC%
    echo.
    echo %YELLOW%PostgreSQL e' necessario per il database.%NC%
    echo Scarica e installa PostgreSQL da: https://www.postgresql.org/download/windows/
    echo.
    echo IMPORTANTE: Durante l'installazione:
    echo   - Ricorda la password impostata per l'utente 'postgres'
    echo   - Mantieni la porta di default (5432^)
    echo.
    echo Vuoi aprire la pagina di download? (S/N^)
    set /p "response="
    if /i "!response!"=="S" start https://www.postgresql.org/download/windows/
    echo.
    echo Dopo aver installato PostgreSQL, RIAVVIA questo script.
    pause
    exit /b 1
)

:: ============================================================================
:: STEP 3: Crea directory e copia i file
:: ============================================================================
echo %YELLOW%^> Copio i file dell'applicazione in %INSTALL_DIR%...%NC%

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

if exist "%SCRIPT_DIR%app" (
    robocopy "%SCRIPT_DIR%app" "%INSTALL_DIR%" /E /XD node_modules dist .next /XF *.log /NFL /NDL /NJH /NJS >nul 2>&1
    if %ERRORLEVEL% leq 7 (
        echo %GREEN%√ File copiati!%NC%
    ) else (
        echo %RED%X Errore durante la copia dei file%NC%
        pause
        exit /b 1
    )
) else (
    echo %RED%X Cartella 'app' non trovata!%NC%
    pause
    exit /b 1
)

:: ============================================================================
:: STEP 4: Installa le dipendenze
:: ============================================================================
echo %YELLOW%^> Installo le dipendenze (questo puo' richiedere diversi minuti^)...%NC%

cd /d "%INSTALL_DIR%"

:: Root
call npm install --legacy-peer-deps 2>nul || call npm install
echo %GREEN%√ Dipendenze root installate%NC%

:: Backend
cd /d "%INSTALL_DIR%\backend"
call npm install --legacy-peer-deps 2>nul || call npm install
echo %GREEN%√ Dipendenze backend installate%NC%

:: Frontend
cd /d "%INSTALL_DIR%\frontend"
call npm install --legacy-peer-deps 2>nul || call npm install
echo %GREEN%√ Dipendenze frontend installate%NC%

cd /d "%INSTALL_DIR%"

:: ============================================================================
:: STEP 5: Configura il database
:: ============================================================================
echo %YELLOW%^> Configuro il database...%NC%

:: Chiedi password PostgreSQL
echo.
echo Inserisci la password dell'utente 'postgres' di PostgreSQL:
set /p "PG_PASSWORD="

:: Crea database
echo %YELLOW%  Creo il database...%NC%
set PGPASSWORD=%PG_PASSWORD%
psql -U postgres -c "CREATE DATABASE ecommerce_price_manager;" 2>nul
echo %GREEN%√ Database creato (o gia' esistente^)%NC%

:: Crea file .env
if not exist "%INSTALL_DIR%\backend\.env" (
    (
        echo # Database
        echo DATABASE_URL="postgresql://postgres:%PG_PASSWORD%@localhost:5432/ecommerce_price_manager?schema=public"
        echo.
        echo # Server
        echo PORT=3000
        echo NODE_ENV=production
        echo.
        echo # JWT
        echo JWT_SECRET=your-super-secret-jwt-key-change-this
        echo JWT_EXPIRES_IN=7d
        echo.
        echo # Encryption
        echo ENCRYPTION_KEY=ecommerce-price-32-char-key-here
        echo.
        echo # Frontend URL
        echo FRONTEND_URL=http://localhost:5173
    ) > "%INSTALL_DIR%\backend\.env"
    echo %GREEN%√ File .env creato%NC%
)

:: Prisma setup
cd /d "%INSTALL_DIR%\backend"
call npx prisma generate
call npx prisma migrate deploy 2>nul || call npx prisma db push
echo %GREEN%√ Database configurato%NC%

cd /d "%INSTALL_DIR%"

:: ============================================================================
:: STEP 6: Build dell'applicazione
:: ============================================================================
echo %YELLOW%^> Compilo l'applicazione...%NC%

:: Build backend
cd /d "%INSTALL_DIR%\backend"
call npm run build 2>nul || call npx tsc
echo %GREEN%√ Backend compilato%NC%

:: Build frontend
cd /d "%INSTALL_DIR%\frontend"
call npm run build
echo %GREEN%√ Frontend compilato%NC%

cd /d "%INSTALL_DIR%"

:: ============================================================================
:: STEP 7: Crea script di avvio
:: ============================================================================
echo %YELLOW%^> Creo gli script di avvio...%NC%

:: Script di avvio del backend
(
echo @echo off
echo cd /d "%INSTALL_DIR%\backend"
echo npm run start
) > "%INSTALL_DIR%\start-backend.bat"

:: Script di avvio del frontend
(
echo @echo off
echo cd /d "%INSTALL_DIR%\frontend"
echo npm run preview -- --port 5173
) > "%INSTALL_DIR%\start-frontend.bat"

:: Script di avvio completo
(
echo @echo off
echo echo Avvio E-commerce Price Manager...
echo echo.
echo start "Backend" /min cmd /c "%INSTALL_DIR%\start-backend.bat"
echo timeout /t 3 /nobreak ^>nul
echo start "Frontend" /min cmd /c "%INSTALL_DIR%\start-frontend.bat"
echo echo.
echo echo Applicazione avviata!
echo echo   Backend:  http://localhost:3000
echo echo   Frontend: http://localhost:5173
echo echo.
echo timeout /t 5 /nobreak ^>nul
) > "%INSTALL_DIR%\start-app.bat"

:: VBS per avvio silenzioso
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.CurrentDirectory = "%INSTALL_DIR%"
echo WshShell.Run """%INSTALL_DIR%\start-backend.bat""", 0, False
echo WScript.Sleep 3000
echo WshShell.Run """%INSTALL_DIR%\start-frontend.bat""", 0, False
) > "%INSTALL_DIR%\start-server.vbs"

:: Script per aprire l'app nel browser
(
echo @echo off
echo setlocal EnableDelayedExpansion
echo set MAX_WAIT=30
echo set WAITED=0
echo :wait_loop
echo curl -s http://localhost:5173 ^>nul 2^>^&1
echo if %%ERRORLEVEL%%==0 goto open_app
echo if %%WAITED%% geq %%MAX_WAIT%% goto open_app
echo timeout /t 1 /nobreak ^>nul
echo set /a WAITED+=1
echo goto wait_loop
echo :open_app
echo set "CHROME_PATH="
echo if exist "%%ProgramFiles%%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%%ProgramFiles%%\Google\Chrome\Application\chrome.exe"
echo if exist "%%LocalAppData%%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%%LocalAppData%%\Google\Chrome\Application\chrome.exe"
echo if defined CHROME_PATH (
echo     start "" "%%CHROME_PATH%%" --app=http://localhost:5173
echo ^) else (
echo     start http://localhost:5173
echo ^)
) > "%INSTALL_DIR%\open-app.bat"

:: VBS per aprire l'app silenziosamente
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.Run """%INSTALL_DIR%\open-app.bat""", 0, False
) > "%INSTALL_DIR%\EcommercePriceManager.vbs"

echo %GREEN%√ Script di avvio creati%NC%

:: ============================================================================
:: STEP 8: Configura avvio automatico
:: ============================================================================
echo %YELLOW%^> Configuro l'avvio automatico...%NC%

copy /Y "%INSTALL_DIR%\start-server.vbs" "%STARTUP_DIR%\EcommercePriceManager-Server.vbs" >nul 2>&1
echo %GREEN%√ Avvio automatico configurato%NC%

:: ============================================================================
:: STEP 9: Crea collegamento sul Desktop
:: ============================================================================
echo %YELLOW%^> Creo il collegamento sul Desktop...%NC%

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%DESKTOP_DIR%\E-commerce Price Manager.lnk'); $s.TargetPath = '%INSTALL_DIR%\EcommercePriceManager.vbs'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Description = 'E-commerce Price Manager'; $s.Save()"

echo %GREEN%√ Collegamento creato sul Desktop%NC%

:: ============================================================================
:: STEP 10: Avvia l'applicazione
:: ============================================================================
echo %YELLOW%^> Avvio l'applicazione...%NC%

start /B "" wscript.exe "%INSTALL_DIR%\start-server.vbs"

echo Attendo che l'applicazione sia pronta...
set MAX_WAIT=60
set WAITED=0

:wait_server
curl -s http://localhost:5173 >nul 2>&1
if %ERRORLEVEL%==0 goto server_ready
if %WAITED% geq %MAX_WAIT% goto server_timeout
timeout /t 2 /nobreak >nul
set /a WAITED+=2
echo.| set /p=.
goto wait_server

:server_timeout
echo.
echo %YELLOW%L'applicazione sta ancora avviando...%NC%
goto installation_complete

:server_ready
echo.
echo %GREEN%√ Applicazione pronta!%NC%

:: ============================================================================
:: COMPLETATO
:: ============================================================================
:installation_complete
echo.
echo %GREEN%========================================================================%NC%
echo %GREEN%          INSTALLAZIONE COMPLETATA CON SUCCESSO!%NC%
echo %GREEN%========================================================================%NC%
echo.
echo L'applicazione e' stata installata:
echo.
echo   📁 Directory:         %INSTALL_DIR%
echo   🚀 Collegamento:      %DESKTOP_DIR%\E-commerce Price Manager.lnk
echo   🔄 Avvio automatico:  Configurato
echo   🌐 Frontend:          http://localhost:5173
echo   🔧 Backend API:       http://localhost:3000
echo.
echo %YELLOW%IMPORTANTE:%NC% Configura le credenziali in:
echo   %INSTALL_DIR%\backend\.env
echo.

echo Vuoi aprire l'applicazione ora? (S/N^)
set /p "open_app="
if /i "!open_app!"=="S" (
    set "CHROME_PATH="
    if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
    if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%LocalAppData%\Google\Chrome\Application\chrome.exe"
    
    if defined CHROME_PATH (
        start "" "!CHROME_PATH!" --app=http://localhost:5173
    ) else (
        start http://localhost:5173
    )
)

echo.
echo Premi un tasto per chiudere...
pause >nul
exit /b 0
