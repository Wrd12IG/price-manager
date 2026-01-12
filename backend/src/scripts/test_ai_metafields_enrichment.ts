import prisma from '../config/database';
import { ShopifyService } from '../services/ShopifyService';
import { logger } from '../utils/logger';

/**
 * Script per testare l'arricchimento AI dei metafields
 * Esegue prepareExport su un numero limitato di prodotti e verifica i metafields generati
 */
async function testAIEnrichment() {
    try {
        console.log('=== TEST ARRICCHIMENTO AI METAFIELDS ===\n');

        // 1. Conta prodotti prima del prepareExport
        const countBefore = await prisma.outputShopify.count();
        console.log(`📦 Prodotti in OutputShopify prima: ${countBefore}\n`);

        // 2. Esegui prepareExport su un numero limitato di prodotti (es. 5)
        console.log('🔄 Esecuzione prepareExport con limite 5 prodotti...\n');
        const prepared = await ShopifyService.prepareExport(5);
        console.log(`\n✅ Preparati ${prepared} prodotti\n`);

        // 3. Analizza i metafields generati
        console.log('=== ANALISI METAFIELDS GENERATI ===\n');

        const products = await prisma.outputShopify.findMany({
            take: 5,
            orderBy: { updatedAt: 'desc' },
            include: {
                masterFile: {
                    select: {
                        eanGtin: true,
                        marca: true,
                        nomeProdotto: true
                    }
                }
            }
        });

        for (const product of products) {
            console.log(`\n📦 ${product.title}`);
            console.log(`   EAN: ${product.masterFile?.eanGtin}`);
            console.log(`   Marca: ${product.masterFile?.marca}`);

            if (product.metafieldsJson) {
                try {
                    const metafields = JSON.parse(product.metafieldsJson);
                    console.log(`   📊 Metafields totali: ${metafields.length}`);

                    // Raggruppa per tipo
                    const byKey: { [key: string]: string } = {};
                    metafields.forEach((mf: any) => {
                        byKey[mf.key] = mf.value.substring(0, 50) + (mf.value.length > 50 ? '...' : '');
                    });

                    // Mostra i metafields chiave
                    const keyFields = [
                        'marca', 'descrizione_breve', 'cpu', 'ram', 'capacita_ssd',
                        'sistema_operativo', 'scheda_video', 'display', 'tipo_pc'
                    ];

                    console.log('\n   Metafields chiave:');
                    keyFields.forEach(key => {
                        const status = byKey[key] ? '✅' : '❌';
                        const value = byKey[key] || 'MANCANTE';
                        console.log(`   ${status} ${key}: ${value}`);
                    });

                } catch (e) {
                    console.log('   ❌ Errore parsing metafields');
                }
            } else {
                console.log('   ⚠️  Nessun metafield');
            }
        }

        // 4. Statistiche finali
        console.log('\n\n=== STATISTICHE FINALI ===\n');

        const allProducts = await prisma.outputShopify.findMany({
            where: { metafieldsJson: { not: null } },
            select: { metafieldsJson: true }
        });

        let totalMetafields = 0;
        let metafieldCounts: { [key: string]: number } = {};
        let productsWithAI = 0;

        allProducts.forEach(p => {
            try {
                const mfs = JSON.parse(p.metafieldsJson!);
                totalMetafields += mfs.length;

                mfs.forEach((mf: any) => {
                    metafieldCounts[mf.key] = (metafieldCounts[mf.key] || 0) + 1;
                });

                // Se ha più di 8 metafields, probabilmente l'AI ha contribuito
                if (mfs.length > 8) {
                    productsWithAI++;
                }
            } catch (e) {
                // Skip
            }
        });

        const avgMetafields = totalMetafields / allProducts.length;
        console.log(`📊 Media metafields per prodotto: ${avgMetafields.toFixed(1)}`);
        console.log(`🤖 Prodotti probabilmente arricchiti con AI: ${productsWithAI} (${((productsWithAI / allProducts.length) * 100).toFixed(1)}%)`);

        console.log('\n🔝 Metafields più comuni:');
        const sorted = Object.entries(metafieldCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15);

        sorted.forEach(([key, count], index) => {
            const percentage = ((count / allProducts.length) * 100).toFixed(1);
            console.log(`${index + 1}. ${key}: ${count}/${allProducts.length} (${percentage}%)`);
        });

        console.log('\n✅ Test completato!\n');

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testAIEnrichment();
