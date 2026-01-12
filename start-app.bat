@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: ╔════════════════════════════════════════════════════════════════════════════╗
:: ║         E-commerce Price Manager - Avvio Applicazione                      ║
:: ║         W[r]Digital                                                         ║
:: ╚════════════════════════════════════════════════════════════════════════════╝

title W[r]Digital Price Manager

set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║        W[r]Digital Price Manager - Avvio                   ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

cd /d "%PROJECT_DIR%"

echo Avvio dell'applicazione in corso...
echo.
echo L'applicazione sara' disponibile su:
echo    Frontend: http://localhost:5173
echo    Backend:  http://localhost:3000
echo.
echo Premi CTRL+C per terminare l'applicazione.
echo.

:: Avvia con npm run dev
call npm run dev

pause
