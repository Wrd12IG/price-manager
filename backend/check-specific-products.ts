import prisma from './src/config/database';
import { EnhancedMetafieldService } from './src/services/EnhancedMetafieldService';

/**
 * Script per investigare i prodotti segnalati dall'utente
 */

const targetPartNumbers = [
    'S5606CA-RI068W',
    'FA808UP-S9023W',
    'B3605CCA-MB0062X',
    'P1403CVA-S61680X'
];

async function investigateProducts() {
    try {
        console.log('🔍 Inizio investigazione prodotti specifici...\n');

        for (const pn of targetPartNumbers) {
            console.log('='.repeat(50));
            console.log(`📦 Prodotto: ${pn}`);
            console.log('='.repeat(50));

            // 1. Cerca nel MasterFile
            const product = await prisma.masterFile.findFirst({
                where: {
                    partNumber: { contains: pn, mode: 'insensitive' }
                },
                include: {
                    marchio: true,
                    categoria: true,
                    datiIcecat: true,
                    outputShopify: true
                }
            });

            if (!product) {
                console.log('❌ Prodotto non trovato nel database MasterFile');
                continue;
            }

            console.log(`ID: ${product.id}`);
            console.log(`Nome: ${product.nomeProdotto}`);
            console.log(`EAN: ${product.eanGtin}`);
            console.log(`ICEcat presente: ${product.datiIcecat ? '✅' : '❌'}`);

            if (product.outputShopify) {
                const metafields = JSON.parse(product.outputShopify.metafieldsJson || '{}');
                const hasTable = !!metafields['custom.tabella_specifiche'];
                console.log(`Tabella in OutputShopify: ${hasTable ? '✅' : '❌'}`);
            } else {
                console.log('Record OutputShopify: ❌ (Non ancora generato)');
            }

            console.log('\n🚀 Test generazione metafields avanzati...');

            try {
                const metafields = await EnhancedMetafieldService.generateCompleteMetafields(
                    product.utenteId,
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

                console.log(`Metafields generati: ${Object.keys(metafields).length}`);
                console.log(`Tabella presente: ${!!metafields['custom.tabella_specifiche'] ? '✅' : '❌'}`);

                if (!metafields['custom.tabella_specifiche']) {
                    console.log('⚠️  TABELLA MANCANTE');
                } else {
                    console.log('✅ TABELLA GENERATA CORRETTAMENTE');
                }
            } catch (err) {
                console.error(`❌ Errore durante il test: ${err.message}`);
            }

            console.log('\n');
        }

        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Errore generale:', error.message);
    }
}

investigateProducts();
