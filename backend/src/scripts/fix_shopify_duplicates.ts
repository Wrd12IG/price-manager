// @ts-nocheck
/**
 * 🔧 FIX DUPLICATI SHOPIFY
 * 
 * Problema: i prodotti venivano resettati da 'uploaded' a 'pending' e ricaricati
 * su Shopify come nuovi, causando duplicati/triplicati/quadruplicati.
 * 
 * Questo script:
 * 1. Mostra la situazione attuale nel DB per Euro PC
 * 2. Mostra quanti prodotti 'uploaded' verranno protetti dalla prossima sync
 * 3. Offre la possibilità di resettare i prodotti 'error' per riprovarli
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixShopifyDuplicates() {
    try {
        console.log('\n🔧 ===== DIAGNOSI E FIX DUPLICATI SHOPIFY =====\n');

        const utenteId = 3; // Euro PC - cambia se necessario

        // 1. Stato attuale
        const [total, pending, uploaded, errori, conShopifyId, senzaShopifyId] = await Promise.all([
            prisma.outputShopify.count({ where: { utenteId } }),
            prisma.outputShopify.count({ where: { utenteId, statoCaricamento: 'pending' } }),
            prisma.outputShopify.count({ where: { utenteId, statoCaricamento: 'uploaded' } }),
            prisma.outputShopify.count({ where: { utenteId, statoCaricamento: 'error' } }),
            prisma.outputShopify.count({ where: { utenteId, shopifyProductId: { not: null } } }),
            prisma.outputShopify.count({ where: { utenteId, shopifyProductId: null } }),
        ]);

        console.log('📊 STATO ATTUALE OUTPUT SHOPIFY:');
        console.log(`   Totale record:     ${total}`);
        console.log(`   📤 Pending:        ${pending}`);
        console.log(`   ✅ Uploaded:       ${uploaded}`);
        console.log(`   ❌ Error:          ${errori}`);
        console.log(`   🔗 Con Shopify ID: ${conShopifyId}`);
        console.log(`   ⚠️ Senza ID:       ${senzaShopifyId} (attenzione: questi NON verranno aggiornati, saranno creati nuovi!)`);

        // 2. Prodotti uploaded senza shopifyProductId (potenzialmente "fantasma" - caricati ma senza ID salvato)
        const uploadedSenzaId = await prisma.outputShopify.findMany({
            where: {
                utenteId,
                statoCaricamento: 'uploaded',
                shopifyProductId: null
            },
            select: { id: true, sku: true, title: true, createdAt: true },
            take: 20
        });

        if (uploadedSenzaId.length > 0) {
            console.log(`\n⚠️ PRODOTTI UPLOADED SENZA SHOPIFY ID (potrebbero essere stati caricati prima del fix):`);
            console.log(`   Trovati: ${uploadedSenzaId.length} prodotti`);
            uploadedSenzaId.slice(0, 10).forEach(p => {
                console.log(`   • [${p.id}] SKU: ${p.sku} - ${p.title?.substring(0, 50)}`);
            });
            if (uploadedSenzaId.length > 10) {
                console.log(`   ... e altri ${uploadedSenzaId.length - 10} prodotti`);
            }
            console.log(`\n   ℹ️ Questi prodotti NON verranno duplicati grazie al fix (il filtro ora controlla statoCaricamento='uploaded')`);
        }

        // 3. Prodotti in errore - questi possono essere resettati
        const prodottiInErrore = await prisma.outputShopify.findMany({
            where: { utenteId, statoCaricamento: 'error' },
            select: { id: true, sku: true, title: true, errorMessage: true },
            take: 20
        });

        if (prodottiInErrore.length > 0) {
            console.log(`\n❌ PRODOTTI IN ERRORE:`);
            prodottiInErrore.forEach(p => {
                console.log(`   • [${p.id}] SKU: ${p.sku}`);
                console.log(`     Errore: ${p.errorMessage?.substring(0, 100) || 'N/A'}`);
            });
        }

        // 4. Verifica: quanti prodotti sarebbero stati (erroneamente) rigenerati con la vecchia logica?
        const prodottiConTabellaCorta = await prisma.outputShopify.count({
            where: {
                utenteId,
                statoCaricamento: 'uploaded', // Questi erano i prodotti già caricati...
                // che venivano resettati se la tabella era corta
            }
        });

        console.log(`\n🔍 DIAGNOSI DEL PROBLEMA:`);
        console.log(`   Con la VECCHIA logica (buggy):`);
        console.log(`   - Ogni sincronizzazione controllava SE la tabella specifiche fosse < 100 chars`);
        console.log(`   - Se sì, resettava il record a 'pending' ANCHE SE era già 'uploaded'`);
        console.log(`   - La sync successiva lo reinviava a Shopify come NUOVO prodotto → DUPLICATO`);
        console.log(`\n   Con il NUOVO fix applicato:`);
        console.log(`   - I prodotti 'uploaded' non vengono MAI rigenerati`);
        console.log(`   - Viene salvato il shopifyProductId dopo ogni caricamento`);
        console.log(`   - Se un prodotto ha già un shopifyProductId, viene fatto PUT (update) invece di POST (create)`);
        console.log(`   - Questo previene duplicati anche in caso di errori temporanei`);

        // 5. Suggerimento azione
        const args = process.argv.slice(2);
        if (args.includes('--reset-errors')) {
            console.log('\n🔄 Reset prodotti in errore a pending...');
            const result = await prisma.outputShopify.updateMany({
                where: { utenteId, statoCaricamento: 'error' },
                data: { statoCaricamento: 'pending', errorMessage: null }
            });
            console.log(`   ✅ Reset ${result.count} prodotti da 'error' a 'pending'`);
        } else {
            if (errori > 0) {
                console.log(`\n💡 Per resettare i ${errori} prodotti in errore e riprovarli, esegui:`);
                console.log(`   npx ts-node src/scripts/fix_shopify_duplicates.ts --reset-errors`);
            }
        }

        console.log('\n✅ Diagnosi completata!\n');
        console.log('📌 NOTA IMPORTANTE: Se ci sono già duplicati su Shopify, devi eliminarli manualmente');
        console.log('   dal pannello admin di Shopify. Il fix previene FUTURI duplicati.');
        console.log('   Puoi filtrare per SKU duplicati nel pannello Shopify per identificarli.');

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixShopifyDuplicates();
