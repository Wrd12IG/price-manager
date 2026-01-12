@echo off
title Aggiornamento E-commerce Price Manager - W[r]Digital
echo ==========================================================
echo    AGGIORNAMENTO E-COMMERCE PRICE MANAGER (Product Code)
echo ==========================================================
echo.

:: 1. Chiusura processi esistenti
echo [1/4] Chiusura server in esecuzione...
taskkill /F /IM node.exe /T >nul 2>&1
echo      Fatto.
echo.

:: 2. Verifica ambiente
echo [2/4] Verifica dipendenze e configurazioni...
cd backend
call npx prisma generate >nul 2>&1
echo      Database pronto.
cd ..
echo.

:: 3. Pulizia Cache (Opzionale ma consigliato)
echo [3/4] Pulizia sessioni temporanee...
if exist "frontend\node_modules\.vite" rd /s /q "frontend\node_modules\.vite"
echo      Fatto.
echo.

:: 4. Riavvio Applicazione
echo [4/4] Avvio dei server (Backend + Frontend)...
echo.
echo ----------------------------------------------------------
echo  L'APPLICAZIONE SI APRIRA' TRA POCHI SECONDI...
echo  - Backend: http://localhost:3000
echo  - Frontend: http://localhost:5173 (Interfaccia)
echo ----------------------------------------------------------
echo.

start "Backend Server" /D backend npm run dev
timeout /t 5 >nul
start "Frontend UI" /D frontend npm run dev

echo.
echo Operazione completata! 
echo Lascia aperte le finestre nere che si sono aperte.
echo.
pause
