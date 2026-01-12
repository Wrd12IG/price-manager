import prisma from '../config/database';
import { ShopifyService } from '../services/ShopifyService';

/**
 * Script per testare le nuove descrizioni intelligenti
 */
async function testSmartDescriptions() {
    try {
        console.log('=== TEST DESCRIZIONI INTELLIGENTI ===\n');

        // Esegui prepareExport su 3 prodotti
        console.log('🔄 Generazione descrizioni per 3 prodotti...\n');
        await ShopifyService.prepareExport(3);

        // Mostra le descrizioni generate
        const products = await prisma.outputShopify.findMany({
            take: 3,
            orderBy: { updatedAt: 'desc' },
            include: {
                masterFile: {
                    select: {
                        eanGtin: true,
                        marca: true,
                        categoriaEcommerce: true
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
            console.log('='.repeat(80));

            if (product.bodyHtml) {
                // Estrai il titolo H2 e il primo paragrafo
                const h2Match = product.bodyHtml.match(/<h2[^>]*>(.*?)<\/h2>/);
                const pMatch = product.bodyHtml.match(/<p[^>]*>(.*?)<\/p>/);

                if (h2Match) {
                    console.log(`\n📝 TITOLO DESCRIZIONE:\n${h2Match[1]}\n`);
                }

                if (pMatch) {
                    // Rimuovi tag HTML dal paragrafo
                    const cleanText = pMatch[1].replace(/<[^>]+>/g, '');
                    console.log(`📄 TESTO DESCRIZIONE:\n${cleanText}\n`);
                }

                // Mostra lunghezza totale HTML
                console.log(`📊 Lunghezza HTML totale: ${product.bodyHtml.length} caratteri`);
            } else {
                console.log('\n⚠️  Nessuna descrizione HTML generata');
            }
        }

        console.log('\n\n✅ Test completato!\n');

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testSmartDescriptions();
