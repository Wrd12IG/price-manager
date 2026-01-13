import { PrismaClient } from '@prisma/client';
import { ImportService } from './src/services/ImportService';
import { MasterFileService } from './src/services/MasterFileService';
import { AIEnrichmentService } from './src/services/AIEnrichmentService';
import { MarkupService } from './src/services/MarkupService';
import { ShopifyService } from './src/services/ShopifyService';
import { logger } from './src/utils/logger';

const prisma = new PrismaClient();

async function simulateFullFlow() {
    console.log('🚀 AVVIO SIMULAZIONE FLUSSO COMPLETO (Senza invio a Shopify)\n');
    const startTime = Date.now();

    try {
        // 1. IMPORTAZIONE & CONSOLIDAMENTO
        // console.log('📁 1/5. Importazione listini e consolidamento Master File...');
        // const importResult = await ImportService.importAllListini();
        // console.log(`   - Risultati: ${JSON.stringify(importResult.results)}`);

        // Per velocizzare il test ed evitare problemi di rete, usiamo i dati già presenti
        // ma forziamo il riconsolidamento per sicurezza.
        console.log('📁 1/5. Consolidamento Master File (Dati esistenti)...');
        await MasterFileService.consolidaMasterFile();
        const masterCount = await prisma.masterFile.count();
        console.log(`   - Prodotti nel Master File: ${masterCount}`);

        // 2. ARRICCHIMENTO AI
        console.log('\n🧠 2/5. Arricchimento AI (Titoli, Descrizioni, Metafield)...');
        // Processiamo un batch di 20 prodotti per dimostrazione
        const aiResult = await AIEnrichmentService.processBatch(20);
        console.log(`   - Processati: ${aiResult.processed}, Successi: ${aiResult.success}`);

        // 3. APPLICAZIONE MARKUP
        console.log('\n💰 3/5. Applicazione regole di Markup e Prezzi...');
        await MarkupService.applicaRegolePrezzi();
        const withPrice = await prisma.masterFile.count({ where: { prezzoVenditaCalcolato: { gt: 0 } } });
        console.log(`   - Prodotti con prezzo calcolato (>0): ${withPrice}`);

        // 4. PREPARAZIONE EXPORT SHOPIFY
        console.log('\n📦 4/5. Preparazione dati per Shopify (Local Table)...');
        const prepCount = await ShopifyService.prepareExport();
        console.log(`   - Prodotti preparati in OutputShopify: ${prepCount}`);

        // 5. VERIFICA FINALE
        console.log('\n📊 5/5. Verifica integrità dati generati...');
        const sample = await prisma.outputShopify.findFirst({
            orderBy: { updatedAt: 'desc' },
            include: { masterFile: true }
        });

        if (sample) {
            console.log('\n--- Esempio Prodotto Generato ---');
            console.log(`Handle: ${sample.handle}`);
            console.log(`Titolo: ${sample.title}`);
            console.log(`Prezzo: €${sample.variantPrice}`);
            console.log(`Vendor: ${sample.vendor}`);
            console.log(`Metafields (anteprima): ${sample.metafieldsJson?.substring(0, 100)}...`);
            console.log('---------------------------------');
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n✅ SIMULAZIONE COMPLETATA IN ${duration}s!`);
        console.log('Tutti i dati sono pronti nelle tabelle locali, nessun dato è stato inviato a Shopify.');

    } catch (error: any) {
        console.error('\n❌ ERRORE DURANTE LA SIMULAZIONE:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

simulateFullFlow();
