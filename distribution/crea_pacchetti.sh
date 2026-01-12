#!/bin/bash

# ============================================================================
# Script per creare il pacchetto di installazione E-commerce Price Manager
# Crea pacchetti sia per Mac che per Windows
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PARENT_DIR"
TEMP_DIR="/tmp/EcommercePriceManager_Installer"

echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║   Creazione Pacchetti E-commerce Price Manager                     ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# Pulisci directory temporanea
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR/app"

echo "➤ Copio i file dell'applicazione..."

# Copia tutti i file necessari (escludi node_modules, dist, logs, ecc.)
rsync -av --progress \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.next' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='.DS_Store' \
    --exclude='logs' \
    --exclude='*.db' \
    --exclude='*.csv' \
    --exclude='tsconfig.tsbuildinfo' \
    --exclude='distribution' \
    --exclude='*.zip' \
    --exclude='E-commerce Price Manager.app' \
    "$PARENT_DIR/" "$TEMP_DIR/app/"

echo ""
echo "➤ Copio gli script di installazione..."

# Copia script di installazione
cp "$SCRIPT_DIR/INSTALLA_EcommercePriceManager.command" "$TEMP_DIR/"
cp "$SCRIPT_DIR/INSTALLA_EcommercePriceManager.bat" "$TEMP_DIR/"

# Rendi eseguibile lo script Mac
chmod +x "$TEMP_DIR/INSTALLA_EcommercePriceManager.command"

# Crea README
cat > "$TEMP_DIR/README_INSTALLAZIONE.txt" << 'EOF'
================================================================================
         E-COMMERCE PRICE MANAGER - GUIDA DI INSTALLAZIONE
================================================================================

REQUISITI:
-----------
Mac:
  - macOS 10.13 o superiore
  - Connessione internet (per scaricare dipendenze)

Windows:
  - Windows 10 o superiore
  - Node.js LTS (https://nodejs.org/)
  - PostgreSQL 14+ (https://www.postgresql.org/download/)

INSTALLAZIONE MAC:
------------------
1. Estrai questo file ZIP
2. Fai doppio clic su "INSTALLA_EcommercePriceManager.command"
3. Se macOS chiede conferma, vai in Preferenze di Sistema > 
   Sicurezza e Privacy > clicca "Apri comunque"
4. Segui le istruzioni a schermo
5. L'installazione richiede circa 10-15 minuti

INSTALLAZIONE WINDOWS:
----------------------
1. PRIMA installa Node.js da https://nodejs.org/ (versione LTS)
2. PRIMA installa PostgreSQL da https://www.postgresql.org/download/windows/
   - Durante l'installazione, ricorda la password impostata
3. Estrai questo file ZIP
4. Fai doppio clic su "INSTALLA_EcommercePriceManager.bat"
5. Se Windows Defender chiede conferma, clicca "Esegui comunque"
6. Quando richiesto, inserisci la password PostgreSQL
7. L'installazione richiede circa 10-15 minuti

DOPO L'INSTALLAZIONE:
---------------------
Mac:
  - App in: ~/EcommercePriceManager
  - Launcher in: /Applications/E-commerce Price Manager.app

Windows:
  - App in: %USERPROFILE%\EcommercePriceManager
  - Collegamento sul Desktop

URL APPLICAZIONE:
-----------------
  Frontend: http://localhost:5173
  Backend:  http://localhost:3000

CONFIGURAZIONE:
---------------
Dopo l'installazione, configura le credenziali in:
  [installazione]/backend/.env

Parametri da configurare:
  - DATABASE_URL (connessione PostgreSQL)
  - SHOPIFY_* (se usi Shopify)
  - ICECAT_* (per arricchimento dati)
  - SMTP_* (per invio email)

SUPPORTO:
---------
Per problemi o domande, contatta il supporto tecnico W[r]Digital.

================================================================================
EOF

echo ""
echo "➤ Creo il pacchetto MAC..."

# Crea pacchetto Mac
MAC_PACKAGE="EcommercePriceManager_Mac_Installer"
mkdir -p "/tmp/$MAC_PACKAGE"
cp -r "$TEMP_DIR/app" "/tmp/$MAC_PACKAGE/"
cp "$TEMP_DIR/INSTALLA_EcommercePriceManager.command" "/tmp/$MAC_PACKAGE/"
cp "$TEMP_DIR/README_INSTALLAZIONE.txt" "/tmp/$MAC_PACKAGE/"
chmod +x "/tmp/$MAC_PACKAGE/INSTALLA_EcommercePriceManager.command"

cd /tmp
rm -f "$OUTPUT_DIR/$MAC_PACKAGE.zip"
zip -r "$OUTPUT_DIR/$MAC_PACKAGE.zip" "$MAC_PACKAGE" -x "*.DS_Store"
rm -rf "/tmp/$MAC_PACKAGE"

# Mostra dimensione
SIZE_MAC=$(du -h "$OUTPUT_DIR/$MAC_PACKAGE.zip" | cut -f1)
echo "   ✓ Pacchetto Mac creato: $SIZE_MAC"

echo ""
echo "➤ Creo il pacchetto WINDOWS..."

# Crea pacchetto Windows
WIN_PACKAGE="EcommercePriceManager_Windows_Installer"
mkdir -p "/tmp/$WIN_PACKAGE"
cp -r "$TEMP_DIR/app" "/tmp/$WIN_PACKAGE/"
cp "$TEMP_DIR/INSTALLA_EcommercePriceManager.bat" "/tmp/$WIN_PACKAGE/"
cp "$TEMP_DIR/README_INSTALLAZIONE.txt" "/tmp/$WIN_PACKAGE/"

cd /tmp
rm -f "$OUTPUT_DIR/$WIN_PACKAGE.zip"
zip -r "$OUTPUT_DIR/$WIN_PACKAGE.zip" "$WIN_PACKAGE" -x "*.DS_Store"
rm -rf "/tmp/$WIN_PACKAGE"

# Mostra dimensione
SIZE_WIN=$(du -h "$OUTPUT_DIR/$WIN_PACKAGE.zip" | cut -f1)
echo "   ✓ Pacchetto Windows creato: $SIZE_WIN"

# Pulisci
rm -rf "$TEMP_DIR"

echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║              PACCHETTI CREATI CON SUCCESSO!                        ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""
echo "File creati in: $OUTPUT_DIR"
echo ""
echo "  🍎 Mac:     $MAC_PACKAGE.zip ($SIZE_MAC)"
echo "  🪟 Windows: $WIN_PACKAGE.zip ($SIZE_WIN)"
echo ""
