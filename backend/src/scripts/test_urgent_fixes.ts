#!/usr/bin/env ts-node
// Script per testare i fix urgenti: tabella HTML e dati EUROPC

import prisma from '../config/database';
import { ShopifyExportService } from '../services/ShopifyExportService';

async function testFixes() {
    try {
        console.log('\n🔧 ===== TEST FIX URGENTI =====\n');

        // 1. CANCELLA E RIGENERA SOLO EUROPC
        console.log('📦 EUROPC: Rigenerazione con fix...\n');

        const deletedEuropc = await prisma.outputShopify.deleteMany({
            where: { utenteId: 3 }
        });
        console.log(`   🗑️ Eliminati ${deletedEuropc.count} record OutputShopify EUROPC`);

        const exportedEuropc = await ShopifyExportService.generateExport(3);
        console.log(`   ✅ Generati ${exportedEuropc.length} prodotti EUROPC con fix\n`);

        // 2. VERIFICA CAMPIONE EUROPC
        const sampleEuropc = await prisma.outputShopify.findFirst({
            where: {
                utenteId: 3,
                metafieldsJson: { not: null }
            }
        });

        if (sampleEuropc) {
            console.log(`📝 Esempio prodotto EUROPC:\n`);
            console.log(`   Titolo: ${sampleEuropc.title}`);
            console.log(`   Vendor: ${sampleEuropc.vendor}`);

            if (sampleEuropc.metafieldsJson) {
                const metafields = JSON.parse(sampleEuropc.metafieldsJson);

                // Controlla tabella specifiche
                if (metafields['custom.tabella_specifiche']) {
                    const table = metafields['custom.tabella_specifiche'];
                    const isHtmlTable = table.startsWith('<table');
                    const isJsonArray = table.startsWith('[');

                    console.log(`\n   ✅ Tabella Specifiche:`);
                    console.log(`      Formato: ${isHtmlTable ? 'HTML ✅' : (isJsonArray ? 'JSON ❌' : 'SCONOSCIUTO')}`);
                    console.log(`      Lunghezza: ${table.length} caratteri`);
                    console.log(`      Anteprima: ${table.substring(0, 150)}...`);
                } else {
                    console.log(`\n   ⚠️ Nessuna tabella specifiche trovata`);
                }

                // Mostra altri metafields
                console.log(`\n   📋 Altri metafields (${Object.keys(metafields).length} totali):`);
                const keys = Object.keys(metafields).filter(k => k !== 'custom.tabella_specifiche');
                keys.slice(0, 5).forEach(key => {
                    const value = String(metafields[key]).substring(0, 50);
                    console.log(`      - ${key}: ${value}${String(metafields[key]).length > 50 ? '...' : ''}`);
                });
            }
        } else {
            console.log('❌ Nessun prodotto EUROPC trovato con metafields!');
        }

        // 3. VERIFICA STATISTICHE
        console.log('\n\n📊 Statistiche EUROPC:');

        const totalEuropc = await prisma.outputShopify.count({
            where: { utenteId: 3 }
        });

        const withMetafields = await prisma.outputShopify.count({
            where: {
                utenteId: 3,
                metafieldsJson: { not: null }
            }
        });

        const vendor4711 = await prisma.outputShopify.count({
            where: {
                utenteId: 3,
                vendor: '4711'
            }
        });

        const vendorAsus = await prisma.outputShopify.count({
            where: {
                utenteId: 3,
                vendor: { contains: 'ASUS', mode: 'insensitive' }
            }
        });

        console.log(`   Totale prodotti: ${totalEuropc}`);
        console.log(`   Con metafields: ${withMetafields} (${Math.round(withMetafields / totalEuropc * 100)}%)`);
        console.log(`   Vendor '4711' (ERRATO): ${vendor4711} ${vendor4711 > 0 ? '❌' : '✅'}`);
        console.log(`   Vendor 'ASUS' (GIUSTO): ${vendorAsus} ${vendorAsus > 0 ? '✅' : ''}`);

        console.log('\n✅ ===== TEST COMPLETATO =====\n');

    } catch (error: any) {
        console.error('\n❌ ERRORE:', error.message);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

testFixes();
