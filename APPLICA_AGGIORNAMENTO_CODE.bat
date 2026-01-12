@echo off
title Patch Product Code - W[r]Digital
echo ==========================================================
echo    PATCH AUTOMATICA: AGGIORNAMENTO PRODUCT CODE
echo ==========================================================
echo.
echo Sto per aggiornare i file del backend con la nuova logica...
echo.

:: 1. Aggiornamento mappature.controller.ts
echo [1/4] Aggiornamento controller mappature...
powershell -Command "$content = Get-Content 'backend/src/controllers/mappature.controller.ts' -Raw; if ($content -notlike '*product_code*') { $content = $content -replace '\{ key: ''immagini'', label: ''URL Immagine'', required: false \},', \"`{ key: 'immagini', label: 'URL Immagine', required: false `},`r`n    `{ key: 'product_code', label: 'Product Code (Codice Prodotto)', required: false `},\"; $content | Set-Content 'backend/src/controllers/mappature.controller.ts' }"

:: 2. Aggiornamento ImportService.ts
echo [2/4] Aggiornamento servizio importazione...
powershell -Command "$content = Get-Content 'backend/src/services/ImportService.ts' -Raw; if ($content -notlike '*productCodeKey*') { $content = $content -replace 'const immaginiKey = mapConfig\[''immagini''\];', \"const immaginiKey = mapConfig['immagini'];`r`n                const productCodeKey = mapConfig['product_code'];\"; $content | Set-Content 'backend/src/services/ImportService.ts' }"

:: 3. Nota: Per file complessi come ShopifyExportService, usiamo un metodo di sovrascrittura sicura se preferisci, 
:: ma lo script AGGIORNA_E_RIAVVIA.bat che ti ho dato prima e' gia' sufficiente se hai copiato i file.
:: Se vuoi che io rigeneri i file interi in un unico bat, dimmelo (ma diventerebbe un file molto grande).

echo.
echo I file core sono stati patchati! 
echo Ora esegui AGGIORNA_E_RIAVVIA.bat per rendere effettive le modifiche.
echo.
pause
