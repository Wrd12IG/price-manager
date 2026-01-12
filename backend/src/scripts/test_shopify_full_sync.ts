import prisma from '../config/database';
import { ShopifyService } from '../services/ShopifyService';
import { logger } from '../utils/logger';

/**
 * Script completo per testare il flusso di sincronizzazione Shopify
 * 1. Prepara i prodotti (prepareExport)
 * 2. Sincronizza su Shopify (syncToShopify)
 * 3. Verifica cosa è stato inviato
 * 4. Identifica eventuali bug
 */
async function testShopifySync() {
    try {
        console.log('='.repeat(100));
        console.log('🚀 TEST COMPLETO SINCRONIZZAZIONE SHOPIFY');
        console.log('='.repeat(100));

        // STEP 1: Verifica configurazione Shopify
        console.log('\n📋 STEP 1: Verifica Configurazione Shopify\n');

        const config = await ShopifyService.getConfig();
        console.log(`Shop URL: ${config.shopUrl || '❌ NON CONFIGURATO'}`);
        console.log(`Access Token: ${config.hasToken ? '✅ Presente' : '❌ Mancante'}`);

        if (!config.shopUrl || !config.hasToken) {
            console.log('\n❌ ERRORE: Configurazione Shopify mancante!');
            console.log('Configura prima le credenziali Shopify.\n');
            return;
        }

        // STEP 2: Prepara i prodotti
        console.log('\n📦 STEP 2: Preparazione Prodotti (prepareExport)\n');
        console.log('Preparazione di 3 prodotti per il test...\n');

        const preparedCount = await ShopifyService.prepareExport(3);
        console.log(`✅ ${preparedCount} prodotti preparati per l'export\n`);

        if (preparedCount === 0) {
            console.log('❌ Nessun prodotto preparato. Verifica i dati nel MasterFile.\n');
            return;
        }

        // STEP 3: Analizza i prodotti preparati
        console.log('\n🔍 STEP 3: Analisi Prodotti Preparati\n');

        const productsToSync = await prisma.outputShopify.findMany({
            where: { statoCaricamento: 'pending' },
            take: 3,
            include: {
                masterFile: {
                    select: {
                        eanGtin: true,
                        marca: true,
                        categoriaEcommerce: true,
                        prezzoVenditaCalcolato: true
                    }
                }
            }
        });

        console.log(`Prodotti in stato 'pending': ${productsToSync.length}\n`);

        for (let i = 0; i < productsToSync.length; i++) {
            const p = productsToSync[i];
            console.log(`\n${'─'.repeat(80)}`);
            console.log(`PRODOTTO ${i + 1}/${productsToSync.length}`);
            console.log(`${'─'.repeat(80)}`);
            console.log(`📦 Titolo: ${p.title}`);
            console.log(`🏷️  Handle: ${p.handle}`);
            console.log(`🏭 Vendor: ${p.vendor}`);
            console.log(`📂 Tipo: ${p.productType}`);
            console.log(`💰 Prezzo: €${p.variantPrice?.toFixed(2)}`);
            console.log(`📊 Inventario: ${p.variantInventoryQty} unità`);
            console.log(`🔖 Tags: ${p.tags?.substring(0, 100)}...`);

            // Analizza metafields
            if (p.metafieldsJson) {
                try {
                    const metafields = JSON.parse(p.metafieldsJson);
                    console.log(`\n📋 Metafields: ${metafields.length} totali`);

                    const metafieldKeys = metafields.map((mf: any) => mf.key);
                    console.log(`   Chiavi: ${metafieldKeys.join(', ')}`);

                    // Verifica metafields critici
                    const critici = ['marca', 'descrizione_breve', 'testo_personalizzato', 'tabella_specifiche'];
                    console.log('\n   Metafields critici:');
                    critici.forEach(key => {
                        const found = metafields.find((mf: any) => mf.key === key);
                        if (found) {
                            const preview = found.value.substring(0, 50).replace(/\n/g, ' ');
                            console.log(`   ✅ ${key}: ${preview}...`);
                        } else {
                            console.log(`   ❌ ${key}: MANCANTE`);
                        }
                    });

                } catch (e) {
                    console.log(`\n❌ Errore parsing metafields: ${e}`);
                }
            } else {
                console.log('\n⚠️  NESSUN METAFIELD');
            }

            // Verifica immagini
            if (p.immaginiUrls) {
                try {
                    const images = JSON.parse(p.immaginiUrls);
                    console.log(`\n🖼️  Immagini: ${images.length}`);
                } catch (e) {
                    console.log('\n⚠️  Errore parsing immagini');
                }
            } else {
                console.log('\n⚠️  NESSUNA IMMAGINE');
            }

            // Verifica bodyHtml
            if (p.bodyHtml) {
                console.log(`\n📝 Body HTML: ${p.bodyHtml.length} caratteri`);
                const hasMarketingIntro = p.bodyHtml.includes('marketing-intro');
                const hasSpecsTable = p.bodyHtml.includes('specs-table');
                console.log(`   ${hasMarketingIntro ? '✅' : '❌'} Marketing Intro`);
                console.log(`   ${hasSpecsTable ? '✅' : '❌'} Specs Table`);
            } else {
                console.log('\n❌ BODY HTML MANCANTE');
            }
        }

        // STEP 4: Sincronizzazione su Shopify
        console.log('\n\n🚀 STEP 4: Sincronizzazione su Shopify\n');
        console.log('Avvio sincronizzazione...\n');

        const syncStartTime = Date.now();

        try {
            await ShopifyService.syncToShopify();
            const syncDuration = ((Date.now() - syncStartTime) / 1000).toFixed(1);
            console.log(`\n✅ Sincronizzazione completata in ${syncDuration}s\n`);
        } catch (syncError: any) {
            console.log(`\n❌ ERRORE durante la sincronizzazione: ${syncError.message}\n`);
            console.log('Stack trace:', syncError.stack);
            return;
        }

        // STEP 5: Verifica risultati
        console.log('\n📊 STEP 5: Verifica Risultati Post-Sync\n');

        const syncedProducts = await prisma.outputShopify.findMany({
            where: {
                id: { in: productsToSync.map(p => p.id) }
            },
            select: {
                id: true,
                title: true,
                handle: true,
                statoCaricamento: true,
                shopifyProductId: true,
                errorMessage: true,
                updatedAt: true
            }
        });

        let successCount = 0;
        let errorCount = 0;

        for (const product of syncedProducts) {
            console.log(`\n${product.title}`);
            console.log(`   Stato: ${product.statoCaricamento}`);
            console.log(`   Shopify ID: ${product.shopifyProductId || 'N/A'}`);

            if (product.statoCaricamento === 'uploaded') {
                console.log(`   ✅ SUCCESSO`);
                successCount++;
            } else if (product.statoCaricamento === 'error') {
                console.log(`   ❌ ERRORE: ${product.errorMessage}`);
                errorCount++;
            } else {
                console.log(`   ⚠️  PENDING (non sincronizzato)`);
            }
        }

        // STEP 6: Riepilogo e Bug Report
        console.log('\n\n' + '='.repeat(100));
        console.log('📈 RIEPILOGO FINALE');
        console.log('='.repeat(100));
        console.log(`\n✅ Prodotti sincronizzati con successo: ${successCount}/${productsToSync.length}`);
        console.log(`❌ Prodotti con errori: ${errorCount}/${productsToSync.length}`);

        if (errorCount > 0) {
            console.log('\n🐛 BUG IDENTIFICATI:\n');
            const errorProducts = syncedProducts.filter(p => p.statoCaricamento === 'error');
            errorProducts.forEach((p, i) => {
                console.log(`${i + 1}. ${p.title}`);
                console.log(`   Errore: ${p.errorMessage}\n`);
            });
        }

        // Verifica metafields su Shopify
        if (successCount > 0) {
            console.log('\n📋 VERIFICA METAFIELDS SU SHOPIFY:\n');
            console.log('Per verificare i metafields su Shopify:');
            console.log(`1. Vai su: https://${config.shopUrl}/admin/products`);
            console.log('2. Apri uno dei prodotti sincronizzati');
            console.log('3. Scorri fino alla sezione "Metafields"');
            console.log('4. Verifica che siano presenti:');
            console.log('   - custom.marca');
            console.log('   - custom.descrizione_breve');
            console.log('   - custom.testo_personalizzato');
            console.log('   - custom.tabella_specifiche');
            console.log('   - Altri metafields tecnici (cpu, ram, etc.)');
        }

        console.log('\n✅ Test completato!\n');

    } catch (error: any) {
        console.error('\n❌ ERRORE CRITICO:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

testShopifySync();
