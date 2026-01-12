#!/bin/bash

# Script di verifica rapida del sistema
# Esegue tutti i test principali e mostra un riepilogo

echo "═══════════════════════════════════════════════════════════"
echo "   VERIFICA RAPIDA SISTEMA - TUTTE LE CORREZIONI"
echo "═══════════════════════════════════════════════════════════"
echo ""

cd backend

echo "🧪 Esecuzione test logica AND/OR..."
npx ts-node src/scripts/test_complete_system.ts 2>&1 | grep -E "(TEST|SUPERATO|FALLITO|✅|❌)" | head -20

echo ""
echo "-----------------------------------------------------------"
echo ""

echo "💰 Verifica applicazione markup con filtri..."
npx ts-node -e "
import prisma from './src/config/database';

async function quickCheck() {
    const total = await prisma.masterFile.count();
    const withPrice = await prisma.masterFile.count({ where: { prezzoVenditaCalcolato: { gt: 0 } } });
    const notebooks = await prisma.masterFile.count({ where: { categoriaEcommerce: { contains: 'NOTEBOOK' } } });
    const notebooksWithPrice = await prisma.masterFile.count({ 
        where: { 
            categoriaEcommerce: { contains: 'NOTEBOOK' },
            prezzoVenditaCalcolato: { gt: 0 }
        } 
    });

    console.log('Prodotti totali:', total);
    console.log('Con prezzo > 0:', withPrice, '(' + ((withPrice/total)*100).toFixed(1) + '%)');
    console.log('');
    console.log('Notebook totali:', notebooks);
    console.log('Notebook con prezzo:', notebooksWithPrice, '(' + ((notebooksWithPrice/notebooks)*100).toFixed(1) + '%)');
    
    if (notebooksWithPrice === notebooks) {
        console.log('');
        console.log('✅ PERFETTO! Tutti i notebook hanno prezzo applicato!');
    } else {
        console.log('');
        console.log('⚠️  Alcuni notebook non hanno prezzo');
    }

    await prisma.\$disconnect();
}

quickCheck();
" 2>&1

echo ""
echo "-----------------------------------------------------------"
echo ""

echo "📊 Stato finale sistema..."
npx ts-node src/scripts/final_verification.ts 2>&1 | grep -E "(✅|⚠️|SISTEMA|SUGGERIMENTO)" | tail -10

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "   VERIFICA COMPLETATA"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Per dettagli completi, consultare:"
echo "  - CORREZIONI_COMPLETATE.md (riepilogo esecutivo)"
echo "  - CORREZIONI_FILTRAGGIO_REPORT.md (dettagli tecnici)"
echo ""
