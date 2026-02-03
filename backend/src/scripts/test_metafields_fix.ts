#!/usr/bin/env ts-node
// Script di test per verificare la generazione dei metafields

import prisma from '../src/config/database';
import { ShopifyExportService } from '../src/services/ShopifyExportService';
import { logger } from '../src/utils/logger';

async function testMetafieldsGeneration() {
    try {
        console.log('🧪 TEST: Generazione Metafields da ICECAT\n');

        // 1. Conta prodotti con dati ICECAT
        const productsWithIcecat = await prisma.masterFile.count({
            where: {
                datiIcecat: {
                    isNot: null
                }
            }
        });

        console.log(`📊 Prodotti con dati ICECAT: ${productsWithIcecat}`);

        if (productsWithIcecat === 0) {
            console.log('⚠️ Nessun prodotto con dati ICECAT trovato. Esegui prima l\'arricchimento ICECAT.');
            process.exit(0);
        }

        // 2. Prendi un prodotto di esempio con dati ICECAT
        const sampleProduct = await prisma.masterFile.findFirst({
            where: {
                datiIcecat: {
                    isNot: null
                }
            },
            include: {
                datiIcecat: true,
                marchio: true,
                categoria: true
            }
        });

        if (!sampleProduct || !sampleProduct.datiIcecat) {
            console.log('❌ Impossibile trovare un prodotto campione.');
            process.exit(1);
        }

        console.log(`\n✅ Prodotto campione: ${sampleProduct.nomeProdotto}`);
        console.log(`   EAN: ${sampleProduct.eanGtin}`);
        console.log(`   Marca: ${sampleProduct.marchio?.nome}`);
        console.log(`   Categoria: ${sampleProduct.categoria?.nome}`);

        // 3. Elimina eventuali record OutputShopify esistenti per questo prodotto
        await prisma.outputShopify.deleteMany({
            where: { masterFileId: sampleProduct.id }
        });

        // 4. Genera l'export (che ora dovrebbe creare i metafields)
        console.log('\n🔄 Generazione export per utente 1...');
        const exported = await ShopifyExportService.generateExport(1);
        console.log(`✅ Export generato per ${exported.length} prodotti`);

        // 5. Verifica che il prodotto campione abbia i metafields
        const outputRecord = await prisma.outputShopify.findFirst({
            where: { masterFileId: sampleProduct.id }
        });

        if (!outputRecord) {
            console.log('❌ Record OutputShopify non creato!');
            process.exit(1);
        }

        console.log('\n📋 Verifica Metafields:');

        if (!outputRecord.metafieldsJson) {
            console.log('❌ ERRORE: metafieldsJson è NULL!');
            console.log('   Il prodotto ha dati ICECAT ma i metafields non sono stati generati.');
            process.exit(1);
        }

        const metafields = JSON.parse(outputRecord.metafieldsJson);
        const metafieldKeys = Object.keys(metafields);

        console.log(`✅ Metafields generati: ${metafieldKeys.length}`);
        console.log('\n📝 Lista metafields:');

        for (const [key, value] of Object.entries(metafields)) {
            const valueStr = String(value).substring(0, 60);
            console.log(`   - ${key}: ${valueStr}${String(value).length > 60 ? '...' : ''}`);
        }

        // 6. Verifica metafields essenziali
        const essentialKeys = ['custom.ean', 'custom.marca'];
        const missingKeys = essentialKeys.filter(k => !metafields[k]);

        if (missingKeys.length > 0) {
            console.log(`\n⚠️ Metafields essenziali mancanti: ${missingKeys.join(', ')}`);
        } else {
            console.log('\n✅ Tutti i metafields essenziali presenti');
        }

        // 7. Statistiche totali
        console.log('\n📊 Statistiche totali:');
        const totalOutputs = await prisma.outputShopify.count({
            where: { metafieldsJson: { not: null } }
        });
        console.log(`   Prodotti con metafields: ${totalOutputs}`);

        console.log('\n✅ TEST COMPLETATO CON SUCCESSO!');
        console.log('\n💡 Prossimi passi:');
        console.log('   1. Verifica che i metafields siano corretti');
        console.log('   2. Testa la sincronizzazione su Shopify');
        console.log('   3. Controlla su Shopify Admin che i metafields siano visibili');

    } catch (error) {
        console.error('❌ Errore durante il test:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

testMetafieldsGeneration();
