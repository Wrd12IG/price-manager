#!/usr/bin/env ts-node
import prisma from '../config/database';
import { ShopifyExportService } from '../services/ShopifyExportService';
import { AIMetafieldService } from '../services/AIMetafieldService';
import { logger } from '../utils/logger';

async function enrichWithAI() {
    const utenti = [
        { id: 2, nome: 'SANTE' },
        { id: 3, nome: 'EUROPC' }
    ];

    console.log('🤖 ARRICCHIMENTO AI per prodotti senza specifiche ICECAT\n');
    logger.level = 'info';

    for (const utente of utenti) {
        console.log(`\n📦 Utente: ${utente.nome} (ID: ${utente.id})`);

        // Trova prodotti senza tabella specifiche
        const productsNeedingAI = await prisma.outputShopify.findMany({
            where: {
                utenteId: utente.id,
                OR: [
                    { metafieldsJson: null },
                    { metafieldsJson: { not: { contains: 'custom.tabella_specifiche' } } }
                ]
            },
            include: {
                masterFile: {
                    include: {
                        datiIcecat: true,
                        marchio: true,
                        categoria: true
                    }
                }
            }
        });

        if (productsNeedingAI.length === 0) {
            console.log('   ✅ Tutti i prodotti hanno già tabella specifiche');
            continue;
        }

        console.log(`   📋 Trovati ${productsNeedingAI.length} prodotti da arricchire con AI\n`);

        let aiSuccess = 0;
        let aiFailed = 0;
        let current = 0;

        for (const product of productsNeedingAI) {
            current++;
            try {
                const ean = product.masterFile.eanGtin || product.title.substring(0, 30);
                console.log(`   [${current}/${productsNeedingAI.length}] 🤖 ${ean}...`);

                const aiMetafields = await AIMetafieldService.generateMetafields(
                    utente.id,
                    product.masterFile
                );

                if (aiMetafields && Object.keys(aiMetafields).length > 0) {
                    const existingMeta = product.metafieldsJson
                        ? JSON.parse(product.metafieldsJson)
                        : {};

                    const mergedMeta = { ...existingMeta, ...aiMetafields };

                    await prisma.outputShopify.update({
                        where: { id: product.id },
                        data: {
                            metafieldsJson: JSON.stringify(mergedMeta)
                        }
                    });

                    aiSuccess++;
                    console.log(`        ✅ ${Object.keys(aiMetafields).length} metafields generati`);
                } else {
                    aiFailed++;
                    console.log(`        ⚠️ AI non ha generato metafields`);
                }

                // Piccola pausa per non sovraccaricare API
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error: any) {
                aiFailed++;
                console.log(`        ❌ Errore: ${error.message}`);
            }
        }

        console.log(`\n   ✅ Completato ${utente.nome}:`);
        console.log(`      Successi: ${aiSuccess}`);
        console.log(`      Fallimenti: ${aiFailed}`);
        console.log(`      Totale: ${productsNeedingAI.length}`);
    }

    console.log('\n🎯 Arricchimento AI completato.');
    await prisma.$disconnect();
}

enrichWithAI().catch(err => {
    console.error('❌ ERRORE:', err);
    process.exit(1);
});
