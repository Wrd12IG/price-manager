#!/usr/bin/env ts-node
// Script per aggiornare i prodotti Shopify per Sante e Europc con il nuovo sistema metafields

import prisma from '../config/database';
import { ShopifyExportService } from '../services/ShopifyExportService';
import { ShopifyService } from '../services/ShopifyService';
import { logger } from '../utils/logger';

const UTENTI = {
    SANTE: 2,
    EUROPC: 3
};

async function checkMetafieldsIntegration() {
    console.log('🔍 ===== VERIFICA INTEGRAZIONE METAFIELDS =====\n');

    for (const [nome, utenteId] of Object.entries(UTENTI)) {
        console.log(`\n📊 Analisi utente: ${nome} (ID: ${utenteId})\n`);

        // 1. Conta prodotti con dati ICECAT
        const conIcecat = await prisma.masterFile.count({
            where: {
                utenteId,
                datiIcecat: { isNot: null }
            }
        });

        // 2. Conta prodotti in OutputShopify
        const inOutput = await prisma.outputShopify.count({
            where: { utenteId }
        });

        // 3. Conta prodotti con metafields
        const conMetafields = await prisma.outputShopify.count({
            where: {
                utenteId,
                metafieldsJson: { not: null }
            }
        });

        // 4. Conta prodotti già uploadati
        const uploaded = await prisma.outputShopify.count({
            where: {
                utenteId,
                statoCaricamento: 'uploaded'
            }
        });

        // 5. Conta prodotti pending
        const pending = await prisma.outputShopify.count({
            where: {
                utenteId,
                statoCaricamento: 'pending'
            }
        });

        console.log(`   MasterFile con ICECAT: ${conIcecat}`);
        console.log(`   Prodotti in OutputShopify: ${inOutput}`);
        console.log(`   Prodotti con metafields: ${conMetafields} (${Math.round(conMetafields / inOutput * 100) || 0}%)`);
        console.log(`   Prodotti uploadati: ${uploaded}`);
        console.log(`   Prodotti pending: ${pending}`);

        // 6. Mostra esempio metafields se disponibili
        if (conMetafields > 0) {
            const sample = await prisma.outputShopify.findFirst({
                where: {
                    utenteId,
                    metafieldsJson: { not: null }
                },
                select: {
                    title: true,
                    metafieldsJson: true
                }
            });

            if (sample?.metafieldsJson) {
                const metafields = JSON.parse(sample.metafieldsJson);
                const keys = Object.keys(metafields);
                console.log(`\n   📝 Esempio metafields (${sample.title}):`);
                console.log(`      Campi: ${keys.length}`);
                keys.slice(0, 5).forEach(key => {
                    const value = String(metafields[key]).substring(0, 50);
                    console.log(`      - ${key}: ${value}${String(metafields[key]).length > 50 ? '...' : ''}`);
                });
                if (keys.length > 5) {
                    console.log(`      ... e altri ${keys.length - 5} campi`);
                }
            }
        }
    }

    console.log('\n' + '='.repeat(60) + '\n');
}

async function regenerateMetafieldsForAll() {
    console.log('🔄 ===== RIGENERAZIONE METAFIELDS =====\n');

    for (const [nome, utenteId] of Object.entries(UTENTI)) {
        console.log(`\n📦 Processando utente: ${nome} (ID: ${utenteId})\n`);

        try {
            // 1. Cancella tutti i record OutputShopify esistenti per rigenerare
            const deleted = await prisma.outputShopify.deleteMany({
                where: { utenteId }
            });
            console.log(`   🗑️ Eliminati ${deleted.count} record OutputShopify esistenti`);

            // 2. Rigenera con i nuovi metafields
            console.log(`   ⚙️ Rigenerazione export con metafields ICECAT...`);
            const exported = await ShopifyExportService.generateExport(utenteId);
            console.log(`   ✅ Generati ${exported.length} prodotti con metafields`);

            // 3. Verifica metafields generati
            const conMetafields = await prisma.outputShopify.count({
                where: {
                    utenteId,
                    metafieldsJson: { not: null }
                }
            });
            console.log(`   📊 Prodotti con metafields: ${conMetafields}/${exported.length} (${Math.round(conMetafields / exported.length * 100)}%)`);

        } catch (error: any) {
            console.error(`   ❌ Errore durante la rigenerazione per ${nome}:`, error.message);
        }
    }

    console.log('\n' + '='.repeat(60) + '\n');
}

async function syncToShopify() {
    console.log('📤 ===== SINCRONIZZAZIONE SHOPIFY =====\n');

    for (const [nome, utenteId] of Object.entries(UTENTI)) {
        console.log(`\n🚀 Sincronizzazione per: ${nome} (ID: ${utenteId})\n`);

        try {
            // Verifica configurazione Shopify
            const config = await ShopifyService.getConfig(utenteId);

            if (!config.configured) {
                console.log(`   ⚠️ Shopify NON configurato per ${nome}. Skipping...`);
                continue;
            }

            console.log(`   ✅ Shopify configurato: ${config.shopUrl}`);

            // Conta prodotti pending
            const pending = await prisma.outputShopify.count({
                where: {
                    utenteId,
                    statoCaricamento: 'pending'
                }
            });

            if (pending === 0) {
                console.log(`   ℹ️ Nessun prodotto pending da sincronizzare`);
                continue;
            }

            console.log(`   📦 Prodotti da sincronizzare: ${pending}`);
            console.log(`   ⏳ Avvio sincronizzazione (potrebbe richiedere qualche minuto)...`);

            // Avvia sincronizzazione
            const result = await ShopifyService.syncProducts(utenteId);

            console.log(`\n   ✅ Sincronizzazione completata!`);
            console.log(`      - Successi: ${result.success}`);
            console.log(`      - Errori: ${result.errors}`);
            console.log(`      - Totale: ${result.total}`);

        } catch (error: any) {
            console.error(`   ❌ Errore durante la sincronizzazione per ${nome}:`, error.message);
        }
    }

    console.log('\n' + '='.repeat(60) + '\n');
}

async function main() {
    try {
        console.log('\n🎯 ===== AGGIORNAMENTO PRODOTTI SHOPIFY =====');
        console.log('📅 Data: ' + new Date().toISOString());
        console.log('👥 Utenti: Sante Dormio, Euro PC Computer\n');
        console.log('='.repeat(60) + '\n');

        // Step 1: Verifica stato attuale
        await checkMetafieldsIntegration();

        // Step 2: Chiedi conferma
        console.log('⚠️  ATTENZIONE: Questo processo cancellerà e ricreerà tutti i record OutputShopify');
        console.log('   per rigenerare i metafields con il nuovo sistema.\n');

        // In produzione, dovresti chiedere conferma. Per ora procediamo.
        console.log('✅ Procedendo con la rigenerazione...\n');

        // Step 3: Rigenera metafields
        await regenerateMetafieldsForAll();

        // Step 4: Verifica post-rigenerazione
        console.log('🔍 Verifica post-rigenerazione:\n');
        await checkMetafieldsIntegration();

        // Step 5: Sincronizza con Shopify
        await syncToShopify();

        console.log('\n✅ ===== PROCESSO COMPLETATO =====\n');
        console.log('💡 Prossimi passi:');
        console.log('   1. Verifica su Shopify Admin che i metafields siano visibili');
        console.log('   2. Controlla i log per eventuali errori');
        console.log('   3. Testa alcuni prodotti sul frontend Shopify\n');

    } catch (error: any) {
        console.error('\n❌ ERRORE FATALE:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Esegui
main();
