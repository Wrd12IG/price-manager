import prisma from '../config/database';
import { ShopifyExportService } from '../services/ShopifyExportService';
import { logger } from '../utils/logger';

async function testAIFallback() {
    console.log('🧪 Test AI Fallback per prodotti senza specifiche ICECAT\n');

    // Trova un prodotto che sappiamo avere specifiche ICECAT vuote
    const prodotto = await prisma.outputShopify.findFirst({
        where: {
            title: { contains: 'ExpertBook P1' }
        },
        include: {
            masterFile: {
                include: { datiIcecat: true }
            }
        }
    });

    if (!prodotto) {
        console.log('❌ Prodotto di test non trovato');
        await prisma.$disconnect();
        return;
    }

    console.log(`📦 Prodotto test: ${prodotto.title}`);
    console.log(`   EAN: ${prodotto.masterFile.eanGtin}`);

    // Verifica che abbia ICECAT vuoto
    if (prodotto.masterFile.datiIcecat?.specificheTecnicheJson) {
        const specs = JSON.parse(prodotto.masterFile.datiIcecat.specificheTecnicheJson);
        console.log(`   Specifiche ICECAT: ${specs.length} (dovrebbe essere 0)`);

        if (specs.length > 0) {
            console.log('   ⚠️ Questo prodotto ha specifiche, cerca uno senza...');
            await prisma.$disconnect();
            return;
        }
    }

    console.log('\n🔄 Elimino e rigenero il record con AI fallback...\n');

    // Elimina il record
    await prisma.outputShopify.delete({
        where: { id: prodotto.id }
    });

    // Abilita logging info
    logger.level = 'info';

    // Rigenera (triggera AI fallback)
    console.log('📊 Generazione in corso (guarda i log AI):\n');
    const exported = await ShopifyExportService.generateExport(prodotto.utenteId);

    // Controlla il risultato
    const nuovo = await prisma.outputShopify.findFirst({
        where: { masterFileId: prodotto.masterFileId }
    });

    if (nuovo?.metafieldsJson) {
        const meta = JSON.parse(nuovo.metafieldsJson);
        const table = meta['custom.tabella_specifiche'];

        console.log(`\n\n✅ Record rigenerato con AI fallback:`);
        console.log(`   Metafields totali: ${Object.keys(meta).length}`);
        console.log(`   Ha tabella specifiche: ${table ? 'SI' : 'NO'}`);

        if (table) {
            console.log(`   Lunghezza tabella: ${table.length} caratteri`);
            console.log(`   Anteprima tabella:\n${table.substring(0, 300)}...`);

            // Verifica che sia HTML
            if (table.includes('<table')) {
                console.log(`\n   ✅ SUCCESSO - Tabella HTML generata da AI!`);
            } else {
                console.log(`\n   ❌ ATTENZIONE - Il formato non è HTML`);
            }
        } else {
            console.log(`\n   ❌ FALLIMENTO - Nessuna tabella generata`);
        }

        // Mostra altri metafields AI
        console.log(`\n   📋 Altri metafields generati da AI:`);
        const aiFields = ['custom.descrizione_breve', 'custom.descrizione_lunga', 'custom.processore_brand', 'custom.ram', 'custom.scheda_video'];
        for (const field of aiFields) {
            if (meta[field]) {
                console.log(`      - ${field}: ${String(meta[field]).substring(0, 60)}...`);
            }
        }
    }

    await prisma.$disconnect();
}

testAIFallback();
