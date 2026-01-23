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
