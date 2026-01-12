#!/usr/bin/env ts-node
/**
 * Script per testare l'applicazione del markup con filtri
 */

import prisma from '../config/database';
import { MarkupService } from '../services/MarkupService';

async function testMarkupWithFilters() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   TEST MARKUP CON FILTRI ATTIVI');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Stato PRIMA del ricalcolo
    console.log('📊 STATO PRIMA DEL RICALCOLO:\n');

    const beforeTotal = await prisma.masterFile.count();
    const beforeWithPrice = await prisma.masterFile.count({
        where: { prezzoVenditaCalcolato: { gt: 0 } }
    });
    const beforeWithoutPrice = await prisma.masterFile.count({
        where: { prezzoVenditaCalcolato: { lte: 0 } }
    });

    console.log(`Prodotti totali: ${beforeTotal}`);
    console.log(`Con prezzo > 0: ${beforeWithPrice}`);
    console.log(`Con prezzo = 0: ${beforeWithoutPrice}`);

    // Mostra alcuni esempi di notebook
    const notebooksBeforeList = await prisma.masterFile.findMany({
        where: {
            categoriaEcommerce: { contains: 'NOTEBOOK' }
        },
        select: {
            eanGtin: true,
            marca: true,
            categoriaEcommerce: true,
            prezzoAcquistoMigliore: true,
            prezzoVenditaCalcolato: true
        },
        take: 5
    });

    console.log('\nEsempi di NOTEBOOK prima del ricalcolo:');
    notebooksBeforeList.forEach(p => {
        console.log(`  ${p.marca} - Acquisto: €${p.prezzoAcquistoMigliore} → Vendita: €${p.prezzoVenditaCalcolato}`);
    });

    // ESEGUI RICALCOLO PREZZI
    console.log('\n-----------------------------------------------------------');
    console.log('🔄 ESECUZIONE RICALCOLO PREZZI CON FILTRI...\n');

    const result = await MarkupService.applicaRegolePrezzi();

    console.log(`✅ Ricalcolo completato!`);
    console.log(`   Processati: ${result.processed}`);
    console.log(`   Aggiornati con markup: ${result.updated}`);
    console.log(`   Esclusi dai filtri: ${result.skippedByFilter}`);

    // Stato DOPO il ricalcolo
    console.log('\n-----------------------------------------------------------');
    console.log('📊 STATO DOPO IL RICALCOLO:\n');

    const afterTotal = await prisma.masterFile.count();
    const afterWithPrice = await prisma.masterFile.count({
        where: { prezzoVenditaCalcolato: { gt: 0 } }
    });
    const afterWithoutPrice = await prisma.masterFile.count({
        where: { prezzoVenditaCalcolato: { lte: 0 } }
    });

    console.log(`Prodotti totali: ${afterTotal}`);
    console.log(`Con prezzo > 0: ${afterWithPrice} (${afterWithPrice - beforeWithPrice >= 0 ? '+' : ''}${afterWithPrice - beforeWithPrice})`);
    console.log(`Con prezzo = 0: ${afterWithoutPrice} (${afterWithoutPrice - beforeWithoutPrice >= 0 ? '+' : ''}${afterWithoutPrice - beforeWithoutPrice})`);

    // Mostra alcuni esempi di notebook DOPO
    const notebooksAfterList = await prisma.masterFile.findMany({
        where: {
            categoriaEcommerce: { contains: 'NOTEBOOK' }
        },
        select: {
            eanGtin: true,
            marca: true,
            categoriaEcommerce: true,
            prezzoAcquistoMigliore: true,
            prezzoVenditaCalcolato: true,
            regolaMarkupId: true
        },
        take: 5
    });

    console.log('\nEsempi di NOTEBOOK dopo il ricalcolo:');
    notebooksAfterList.forEach(p => {
        const markup = p.prezzoVenditaCalcolato > 0
            ? `+${(((p.prezzoVenditaCalcolato - p.prezzoAcquistoMigliore) / p.prezzoAcquistoMigliore) * 100).toFixed(0)}%`
            : 'N/A';
        const status = p.prezzoVenditaCalcolato > 0 ? '✅' : '❌';
        console.log(`  ${status} ${p.marca} - Acquisto: €${p.prezzoAcquistoMigliore} → Vendita: €${p.prezzoVenditaCalcolato} (${markup})`);
    });

    // Verifica prodotti NON-notebook
    const nonNotebooks = await prisma.masterFile.findMany({
        where: {
            categoriaEcommerce: { not: { contains: 'NOTEBOOK' } }
        },
        select: {
            eanGtin: true,
            marca: true,
            categoriaEcommerce: true,
            prezzoAcquistoMigliore: true,
            prezzoVenditaCalcolato: true
        },
        take: 5
    });

    console.log('\nEsempi di NON-NOTEBOOK (dovrebbero avere prezzo = 0):');
    nonNotebooks.forEach(p => {
        const status = p.prezzoVenditaCalcolato === 0 ? '✅' : '❌ ERRORE!';
        console.log(`  ${status} ${p.marca} - ${p.categoriaEcommerce} - Vendita: €${p.prezzoVenditaCalcolato}`);
    });

    // VERIFICA FINALE
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   VERIFICA FINALE');
    console.log('═══════════════════════════════════════════════════════════\n');

    const notebooksWithPrice = await prisma.masterFile.count({
        where: {
            categoriaEcommerce: { contains: 'NOTEBOOK' },
            prezzoVenditaCalcolato: { gt: 0 }
        }
    });

    const notebooksWithoutPrice = await prisma.masterFile.count({
        where: {
            categoriaEcommerce: { contains: 'NOTEBOOK' },
            prezzoVenditaCalcolato: { lte: 0 }
        }
    });

    const nonNotebooksWithPrice = await prisma.masterFile.count({
        where: {
            categoriaEcommerce: { not: { contains: 'NOTEBOOK' } },
            prezzoVenditaCalcolato: { gt: 0 }
        }
    });

    const nonNotebooksWithoutPrice = await prisma.masterFile.count({
        where: {
            categoriaEcommerce: { not: { contains: 'NOTEBOOK' } },
            prezzoVenditaCalcolato: { lte: 0 }
        }
    });

    console.log('NOTEBOOK:');
    console.log(`  Con prezzo > 0: ${notebooksWithPrice} ✅`);
    console.log(`  Con prezzo = 0: ${notebooksWithoutPrice} ${notebooksWithoutPrice > 0 ? '⚠️' : '✅'}`);

    console.log('\nNON-NOTEBOOK:');
    console.log(`  Con prezzo > 0: ${nonNotebooksWithPrice} ${nonNotebooksWithPrice > 0 ? '❌ ERRORE!' : '✅'}`);
    console.log(`  Con prezzo = 0: ${nonNotebooksWithoutPrice} ✅`);

    if (nonNotebooksWithPrice === 0 && notebooksWithPrice > 0) {
        console.log('\n✅ PERFETTO! Il markup è stato applicato SOLO ai notebook come previsto!');
    } else {
        console.log('\n⚠️  ATTENZIONE: Ci sono prodotti non-notebook con prezzo > 0');
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');

    await prisma.$disconnect();
}

testMarkupWithFilters()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Errore:', error);
        process.exit(1);
    });
