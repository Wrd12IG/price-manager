import { ShopifyExportService } from './src/services/ShopifyExportService';
import prisma from './src/config/database';

/**
 * Script per preparare l'export Shopify per l'utente SANTE
 * con i nuovi metafields avanzati
 */

async function prepareShopifyExportForSante() {
    const SANTE_USER_ID = 2;

    try {
        console.log('='.repeat(80));
        console.log('🚀 PREPARAZIONE EXPORT SHOPIFY PER SANTE');
        console.log('='.repeat(80));
        console.log('Utente ID:', SANTE_USER_ID);
        console.log('Email: sante.dormio@gmail.com\n');

        // Conta prodotti nel Master File
        const totalProducts = await prisma.masterFile.count({
            where: { utenteId: SANTE_USER_ID }
        });

        console.log(`📦 Prodotti totali nel Master File: ${totalProducts}\n`);

        if (totalProducts === 0) {
            console.log('⚠️  Nessun prodotto trovato per questo utente!');
            await prisma.$disconnect();
            return;
        }

        console.log('🔧 Avvio generazione export con NUOVI metafields avanzati...');
        console.log('   • Estrazione da ICECAT');
        console.log('   • Web scraping validato (ASUS.com, MediaWorld, AsusStore, AsusWorld)');
        console.log('   • AI extraction con validazione 100%');
        console.log('   • Metafields individuali: CPU, RAM, GPU, Storage, OS, Display, ecc.\n');
        console.log('-'.repeat(80));

        const startTime = Date.now();

        // Genera l'export con il nuovo servizio avanzato
        await ShopifyExportService.generateExport(SANTE_USER_ID);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('-'.repeat(80));
        console.log(`\n✅ Export preparato in ${duration} secondi!\n`);

        // Mostra statistiche
        const stats = await ShopifyExportService.getStats(SANTE_USER_ID);

        console.log('='.repeat(80));
        console.log('📊 STATISTICHE EXPORT');
        console.log('='.repeat(80));
        console.log(`Prodotti pronti per Shopify: ${stats.total}`);
        console.log(`Già caricati su Shopify: ${stats.uploaded}`);
        console.log(`Da caricare: ${stats.ready}`);
        console.log(`Errori: ${stats.errors}\n`);

        // Mostra alcuni esempi di metafields generati
        console.log('='.repeat(80));
        console.log('🏷️  ESEMPIO METAFIELDS GENERATI');
        console.log('='.repeat(80));

        const sampleProducts = await prisma.outputShopify.findMany({
            where: {
                utenteId: SANTE_USER_ID,
                metafieldsJson: { not: null }
            },
            take: 3,
            orderBy: { updatedAt: 'desc' }
        });

        for (const product of sampleProducts) {
            console.log(`\n📦 ${product.title}`);
            console.log(`   SKU: ${product.sku}`);

            if (product.metafieldsJson) {
                try {
                    const metafields = JSON.parse(product.metafieldsJson);
                    const count = Object.keys(metafields).length;
                    console.log(`   Metafields: ${count}`);

                    // Mostra i primi 5 metafields
                    const keys = Object.keys(metafields).slice(0, 5);
                    keys.forEach(key => {
                        const value = metafields[key];
                        const preview = String(value).length > 50
                            ? String(value).substring(0, 50) + '...'
                            : value;
                        console.log(`   • ${key}: ${preview}`);
                    });

                    if (Object.keys(metafields).length > 5) {
                        console.log(`   ... e altri ${Object.keys(metafields).length - 5} metafields`);
                    }
                } catch (e) {
                    console.log('   ⚠️  Errore parsing metafields');
                }
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ PREPARAZIONE COMPLETATA');
        console.log('='.repeat(80));
        console.log('\n📍 PROSSIMO PASSO:');
        console.log('   Vai su dashboard → Shopify → Sincronizza su Shopify');
        console.log('   Oppure usa: curl -X POST http://localhost:3000/api/shopify/sync\n');

        await prisma.$disconnect();

    } catch (error: any) {
        console.error('\n❌ ERRORE:', error.message);
        console.error('Stack:', error.stack);
        await prisma.$disconnect();
        process.exit(1);
    }
}

prepareShopifyExportForSante();
