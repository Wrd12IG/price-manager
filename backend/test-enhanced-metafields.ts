import { EnhancedMetafieldService } from './src/services/EnhancedMetafieldService';
import prisma from './src/config/database';
import { logger } from './src/utils/logger';

/**
 * Script di test per verificare la generazione metafields avanzata
 * Cerca il prodotto ASUS ROG Strix G16 e genera tutti i metafields
 */

async function testEnhancedMetafields() {
    try {
        console.log('🔍 Ricerca prodotto ASUS ROG Strix G16...\n');

        // Cerca il prodotto ASUS ROG Strix G16
        const product = await prisma.masterFile.findFirst({
            where: {
                OR: [
                    { nomeProdotto: { contains: 'G615', mode: 'insensitive' } },
                    { nomeProdotto: { contains: 'Strix G16', mode: 'insensitive' } },
                    { nomeProdotto: { contains: '14650HX', mode: 'insensitive' } },
                    { nomeProdotto: { contains: 'i7-14650HX', mode: 'insensitive' } },
                    { partNumber: { contains: 'G615JMR', mode: 'insensitive' } }
                ]
            },
            include: {
                marchio: true,
                categoria: true,
                datiIcecat: true
            }
        });

        if (!product) {
            console.log('❌ Prodotto ASUS ROG Strix G16 non trovato nel database\n');

            // Mostra alcuni prodotti ASUS disponibili
            const asusProducts = await prisma.masterFile.findMany({
                where: {
                    marchio: { nome: { contains: 'ASUS', mode: 'insensitive' } }
                },
                include: {
                    marchio: true
                },
                take: 5
            });

            console.log('Prodotti ASUS disponibili nel database:');
            asusProducts.forEach(p => {
                console.log(`  - ${p.nomeProdotto} (EAN: ${p.eanGtin}, PN: ${p.partNumber})`);
            });

            await prisma.$disconnect();
            return;
        }

        console.log('='.repeat(80));
        console.log('📦 PRODOTTO TROVATO:');
        console.log('='.repeat(80));
        console.log('Nome:', product.nomeProdotto);
        console.log('EAN:', product.eanGtin);
        console.log('Part Number:', product.partNumber || 'N/D');
        console.log('Marca:', product.marchio?.nome || 'N/D');
        console.log('Categoria:', product.categoria?.nome || 'N/D');
        console.log('Ha dati ICECAT:', !!product.datiIcecat);
        console.log('');

        // Ottieni l'ID utente del prodotto
        const utenteId = product.utenteId;

        console.log('🚀 GENERAZIONE METAFIELDS AVANZATI...\n');
        console.log('Strategia:');
        console.log('  1️⃣  Estrazione da ICECAT (se disponibile)');
        console.log('  2️⃣  Web Scraping da siti autorizzati:');
        console.log('      - ASUS Official IT (www.asus.com/it/)');
        console.log('      - MediaWorld (www.mediaworld.it)');
        console.log('      - AsusStore (www.asustore.it)');
        console.log('      - AsusWorld (www.asusworld.it)');
        console.log('  3️⃣  Estrazione AI con validazione 100%');
        console.log('  4️⃣  NESSUNA invenzione - solo dati verificati\n');
        console.log('-'.repeat(80));

        const startTime = Date.now();

        // Genera metafields con il servizio avanzato
        const metafields = await EnhancedMetafieldService.generateCompleteMetafields(
            utenteId,
            {
                id: product.id,
                eanGtin: product.eanGtin,
                partNumber: product.partNumber,
                nomeProdotto: product.nomeProdotto,
                marchio: product.marchio,
                categoria: product.categoria,
                datiIcecat: product.datiIcecat
            }
        );

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('');
        console.log('='.repeat(80));
        console.log('✅ METAFIELDS GENERATI');
        console.log('='.repeat(80));
        console.log(`Tempo di generazione: ${duration} secondi`);
        console.log(`Numero totale metafields: ${Object.keys(metafields).length}\n`);

        // Mostra i metafields generati
        const metafieldsList = Object.entries(metafields).sort(([a], [b]) => a.localeCompare(b));

        for (const [key, value] of metafieldsList) {
            const displayValue = String(value).length > 100
                ? String(value).substring(0, 100) + '...'
                : value;

            console.log(`✓ ${key}`);
            console.log(`  ${displayValue}\n`);
        }

        console.log('='.repeat(80));
        console.log('📊 ANALISI COMPLETEZZA');
        console.log('='.repeat(80));

        const requiredFields = {
            'custom.ean': 'EAN',
            'custom.marca': 'Marca',
            'custom.processore_brand': 'Processore',
            'custom.ram': 'RAM',
            'custom.capacita_ssd': 'Storage',
            'custom.scheda_video': 'GPU',
            'custom.sistema_operativo': 'Sistema Operativo',
            'custom.dimensione_monitor': 'Dimensione Monitor',
            'custom.tipo_pc': 'Tipo PC',
            'custom.descrizione_breve': 'Descrizione Breve',
            'custom.tabella_specifiche': 'Tabella Specifiche'
        };

        let completeCount = 0;
        let missingCount = 0;

        for (const [field, label] of Object.entries(requiredFields)) {
            const hasValue = metafields[field] && metafields[field].length > 0;
            const status = hasValue ? '✅' : '❌';
            console.log(`${status} ${label}: ${hasValue ? 'OK' : 'MANCANTE'}`);

            if (hasValue) completeCount++;
            else missingCount++;
        }

        console.log('');
        console.log(`Completezza: ${completeCount}/${Object.keys(requiredFields).length} campi obbligatori`);
        const percentage = Math.round((completeCount / Object.keys(requiredFields).length) * 100);
        console.log(`Percentuale: ${percentage}%`);

        if (percentage === 100) {
            console.log('\n🎉 PERFETTO! Tutti i metafields obbligatori sono stati generati!');
        } else if (percentage >= 80) {
            console.log('\n✅ BUONO! La maggior parte dei metafields sono stati generati.');
        } else if (percentage >= 50) {
            console.log('\n⚠️  INCOMPLETO! Alcuni metafields mancanti potrebbero richiedere dati web aggiuntivi.');
        } else {
            console.log('\n❌ INSUFFICIENTE! Molti metafields mancanti. Verifica i dati ICECAT o la disponibilità web.');
        }

        console.log('\n' + '='.repeat(80));
        console.log('💾 SALVATAGGIO NEL DATABASE (OutputShopify)...');

        // Salva/Aggiorna il record OutputShopify con i nuovi metafields
        const outputShopify = await prisma.outputShopify.upsert({
            where: { masterFileId: product.id },
            create: {
                utenteId: product.utenteId,
                masterFileId: product.id,
                title: product.nomeProdotto || 'Prodotto',
                handle: `${(product.nomeProdotto || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${product.id}`,
                bodyHtml: metafields['custom.descrizione_lunga'] || `<p>${product.nomeProdotto}</p>`,
                vendor: product.marchio?.nome || 'Generico',
                productType: product.categoria?.nome || 'Hardware',
                sku: product.partNumber || `SKU-${product.id}`,
                barcode: product.eanGtin,
                variantPrice: product.prezzoVenditaCalcolato || 0,
                variantInventoryQty: product.quantitaTotaleAggregata || 0,
                metafieldsJson: JSON.stringify(metafields),
                statoCaricamento: 'pending'
            },
            update: {
                metafieldsJson: JSON.stringify(metafields),
                statoCaricamento: 'pending',
                bodyHtml: metafields['custom.descrizione_lunga'] || undefined
            }
        });

        console.log(`✅ Record OutputShopify aggiornato (ID: ${outputShopify.id})`);
        console.log(`   Stato: ${outputShopify.statoCaricamento}`);
        console.log(`   Shopify Product ID: ${outputShopify.shopifyProductId || 'Non ancora sincronizzato'}`);

        console.log('\n' + '='.repeat(80));
        console.log('✨ TEST COMPLETATO CON SUCCESSO!');
        console.log('='.repeat(80));
        console.log('\nProssimi passi:');
        console.log('  1. Verifica i metafields generati');
        console.log('  2. Esegui la sincronizzazione con Shopify');
        console.log('  3. Controlla che i metafields siano visibili su Shopify Admin\n');

    } catch (error: any) {
        console.error('\n❌ ERRORE:', error.message);
        console.error('\nStack trace:', error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

// Esegui il test
testEnhancedMetafields();
