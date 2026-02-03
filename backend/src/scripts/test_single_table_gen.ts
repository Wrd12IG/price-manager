import prisma from '../config/database';
import { ShopifyExportService } from '../services/ShopifyExportService';
import { logger } from '../utils/logger';

async function testSingleProduct() {
    console.log('🧪 Test generazione tabella con logging\n');

    // Trova un prodotto che sappiamo avere tabella corta
    const prodotto = await prisma.outputShopify.findFirst({
        where: {
            title: { contains: 'Asus NUC 15' }
        },
        include: {
            masterFile: {
                include: { datiIcecat: true }
            }
        }
    });

    if (!prodotto) {
        console.log('❌ Prodotto non trovato');
        return;
    }

    console.log(`📦 Prodotto: ${prodotto.title}`);
    console.log(`   Master File ID: ${prodotto.masterFileId}`);
    console.log(`   Ha ICECAT: ${prodotto.masterFile.datiIcecat ? 'SI' : 'NO'}`);

    if (prodotto.masterFile.datiIcecat?.specificheTecnicheJson) {
        const specs = JSON.parse(prodotto.masterFile.datiIcecat.specificheTecnicheJson);
        console.log(`   Numero specifiche ICECAT: ${specs.length}\n`);

        console.log('🔄 Cancello e rigenero il record OutputShopify...\n');

        // Elimina il record
        await prisma.outputShopify.delete({
            where: { id: prodotto.id }
        });

        // Impost logging a debug
        logger.level = 'debug';

        // Rigenera con logging attivo
        console.log('📊 Generazione in corso (guarda i log debug):\n');
        const exported = await ShopifyExportService.generateExport(prodotto.utenteId);

        // Controlla il risultato
        const nuovo = await prisma.outputShopify.findFirst({
            where: { masterFileId: prodotto.masterFileId }
        });

        if (nuovo?.metafieldsJson) {
            const meta = JSON.parse(nuovo.metafieldsJson);
            const table = meta['custom.tabella_specifiche'];

            console.log(`\n\n✅ Record rigenerato:`);
            console.log(`   Tabella lunghezza: ${table ? table.length : 'NULL'} caratteri`);

            if (table && table.length < 200) {
                console.log(`   ❌ PROBLEMA PERSISTE - Tabella ancora corta`);
                console.log(`   Contenuto: ${table}`);
            } else if (table) {
                console.log(`   ✅ RISOLTO - Tabella generata correttamente`);
                console.log(`   Anteprima: ${table.substring(0, 150)}...`);
            }
        }
    }

    await prisma.$disconnect();
}

testSingleProduct();
