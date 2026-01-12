#!/usr/bin/env tsx
import { ShopifyService } from '../services/ShopifyService';
import { logger } from '../utils/logger';
import prisma from '../config/database';

async function updateMetafields() {
    console.log('\n🔄 Aggiornamento metafields con nuove chiavi...\n');

    try {
        // 1. Conta prodotti da aggiornare
        const count = await prisma.outputShopify.count({
            where: { statoCaricamento: 'uploaded' }
        });

        console.log(`📊 Trovati ${count} prodotti già caricati su Shopify`);
        console.log('🔧 Ri-preparazione con nuove chiavi metafield...\n');

        // 2. Ri-prepara tutti i prodotti (questo aggiornerà i metafields con le nuove chiavi)
        const prepared = await ShopifyService.prepareExport();

        console.log(`\n✅ Preparati ${prepared} prodotti con nuovi metafields`);

        // 3. Reset stato a pending per ri-sincronizzare
        console.log('\n🔄 Reset stato prodotti a "pending" per ri-sync...');

        const updated = await prisma.outputShopify.updateMany({
            where: {
                statoCaricamento: 'uploaded',
                shopifyProductId: { not: null }
            },
            data: { statoCaricamento: 'pending' }
        });

        console.log(`✅ ${updated.count} prodotti pronti per ri-sincronizzazione`);

        console.log('\n📤 Avvio sincronizzazione con Shopify...\n');

        // 4. Sincronizza (questo aggiornerà i metafields su Shopify)
        await ShopifyService.syncToShopify();

        console.log('\n✅ Sincronizzazione completata!');
        console.log('\n📋 Riepilogo:');
        console.log(`   • Prodotti preparati: ${prepared}`);
        console.log(`   • Prodotti sincronizzati: ${updated.count}`);
        console.log(`   • Nuove chiavi metafield: ean, marca, processore_brand, ram, capacita_ssd, etc.`);

    } catch (error: any) {
        console.error('\n❌ Errore:', error.message);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

updateMetafields().catch(console.error);
