import prisma from './src/config/database';

async function checkSingleProduct() {
    try {
        // Prendi un prodotto caricato su Shopify
        const product = await prisma.outputShopify.findFirst({
            where: {
                utenteId: 2,
                statoCaricamento: 'uploaded',
                shopifyProductId: { not: null }
            },
            orderBy: { updatedAt: 'desc' }
        });

        if (!product) {
            console.log('Nessun prodotto caricato trovato');
            await prisma.$disconnect();
            return;
        }

        console.log('📦 PRODOTTO ESEMPIO:\n');
        console.log('Titolo:', product.title);
        console.log('SKU:', product.sku);
        console.log('Shopify Product ID:', product.shopifyProductId);
        console.log('Stato:', product.statoCaricamento);
        console.log('\n📋 METAFIELDS NEL DATABASE:\n');

        if (product.metafieldsJson) {
            const metafields = JSON.parse(product.metafieldsJson);
            console.log(`Totale metafields: ${Object.keys(metafields).length}\n`);

            Object.entries(metafields).forEach(([key, value]) => {
                const display = String(value).length > 60
                    ? String(value).substring(0, 60) + '...'
                    : value;
                console.log(`${key}:`);
                console.log(`  ${display}\n`);
            });
        } else {
            console.log('⚠️  Nessun metafield nel database');
        }

        await prisma.$disconnect();
    } catch (error: any) {
        console.error('Errore:', error.message);
        await prisma.$disconnect();
    }
}

checkSingleProduct();
