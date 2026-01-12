import prisma from '../config/database';
import { ShopifyService } from '../services/ShopifyService';

/**
 * Script per testare la generazione di testi promozionali AI
 */
async function testPromotionalTexts() {
    try {
        console.log('=== TEST TESTI PROMOZIONALI AI ===\n');

        // Esegui prepareExport su 5 prodotti
        console.log('🔄 Generazione testi promozionali per 5 prodotti...\n');
        await ShopifyService.prepareExport(5);

        // Recupera i prodotti con metafields
        const products = await prisma.outputShopify.findMany({
            take: 5,
            orderBy: { updatedAt: 'desc' },
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

        for (const product of products) {
            console.log('\n' + '='.repeat(80));
            console.log(`📦 ${product.title}`);
            console.log(`🏷️  EAN: ${product.masterFile?.eanGtin}`);
            console.log(`🏭 Marca: ${product.masterFile?.marca}`);
            console.log(`📂 Categoria: ${product.masterFile?.categoriaEcommerce}`);
            console.log(`💰 Prezzo: €${product.masterFile?.prezzoVenditaCalcolato?.toFixed(2)}`);
            console.log('='.repeat(80));

            if (product.metafieldsJson) {
                try {
                    const metafields = JSON.parse(product.metafieldsJson);

                    // Trova il testo personalizzato
                    const testoPersonalizzato = metafields.find(
                        (mf: any) => mf.key === 'testo_personalizzato'
                    );

                    if (testoPersonalizzato) {
                        console.log('\n🎯 TESTO PROMOZIONALE:');
                        console.log('─'.repeat(80));
                        console.log(testoPersonalizzato.value);
                        console.log('─'.repeat(80));
                        console.log(`📏 Lunghezza: ${testoPersonalizzato.value.length} caratteri`);

                        // Verifica qualità
                        const hasGeneric = [
                            'scopri',
                            'questo prodotto',
                            'la soluzione ideale',
                            'progettato per integrarsi'
                        ].some(phrase => testoPersonalizzato.value.toLowerCase().includes(phrase));

                        if (hasGeneric) {
                            console.log('⚠️  ATTENZIONE: Contiene frasi generiche (probabilmente fallback)');
                        } else {
                            console.log('✅ Testo specifico e professionale (probabilmente AI)');
                        }
                    } else {
                        console.log('\n❌ Metafield "testo_personalizzato" non trovato');
                    }

                    // Mostra anche descrizione_breve se presente
                    const descBreve = metafields.find(
                        (mf: any) => mf.key === 'descrizione_breve'
                    );
                    if (descBreve) {
                        console.log('\n📝 Descrizione Breve:');
                        console.log(descBreve.value.substring(0, 100) + '...');
                    }

                } catch (e) {
                    console.log('\n❌ Errore parsing metafields');
                }
            } else {
                console.log('\n⚠️  Nessun metafield trovato');
            }
        }

        // Statistiche
        console.log('\n\n=== STATISTICHE ===\n');

        const allProducts = await prisma.outputShopify.findMany({
            where: { metafieldsJson: { not: null } },
            select: { metafieldsJson: true }
        });

        let withPromo = 0;
        let avgLength = 0;

        allProducts.forEach(p => {
            try {
                const mfs = JSON.parse(p.metafieldsJson!);
                const promo = mfs.find((mf: any) => mf.key === 'testo_personalizzato');
                if (promo) {
                    withPromo++;
                    avgLength += promo.value.length;
                }
            } catch (e) {
                // Skip
            }
        });

        console.log(`📊 Prodotti con testo promozionale: ${withPromo}/${allProducts.length}`);
        if (withPromo > 0) {
            console.log(`📏 Lunghezza media: ${(avgLength / withPromo).toFixed(0)} caratteri`);
        }

        console.log('\n✅ Test completato!\n');

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testPromotionalTexts();
