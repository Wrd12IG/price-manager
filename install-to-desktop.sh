#!/bin/bash

# Script per installare l'app sul Desktop

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Installazione E-commerce Price Manager sul Desktop      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Copia l'app sul Desktop
cp -R "E-commerce Price Manager.app" ~/Desktop/

if [ $? -eq 0 ]; then
    echo "✓ Applicazione copiata sul Desktop!"
    echo ""
    echo "📱 Puoi ora:"
    echo "   1. Fare doppio click sull'icona sul Desktop"
    echo "   2. Trascinare l'app nel Dock per un accesso rapido"
    echo "   3. Trascinare l'app nella cartella Applicazioni"
    echo ""
    echo "🚀 L'app aprirà automaticamente il terminale e il browser!"
else
    echo "✗ Errore durante la copia"
    exit 1
fi
