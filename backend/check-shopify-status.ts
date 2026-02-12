import prisma from './src/config/database';

async function checkShopifyStatus() {
    const SANTE_ID = 2;

    try {
        console.log('🔍 VERIFICA STATO SHOPIFY PER SANTE\n');
        console.log('='.repeat(80));

        // Statistiche generali
        const totalMaster = await prisma.masterFile.count({ where: { utenteId: SANTE_ID } });
        const totalOutput = await prisma.outputShopify.count({ where: { utenteId: SANTE_ID } });
        const withMeta = await prisma.outputShopify.count({
            where: { utenteId: SANTE_ID, metafieldsJson: { not: null } }
        });
        const pending = await prisma.outputShopify.count({
            where: { utenteId: SANTE_ID, statoCaricamento: 'pending' }
        });
        const uploaded = await prisma.outputShopify.count({
            where: { utenteId: SANTE_ID, statoCaricamento: 'uploaded' }
        });
        const errors = await prisma.outputShopify.count({
            where: { utenteId: SANTE_ID, statoCaricamento: 'error' }
        });

        console.log('📊 STATISTICHE GENERALI');
        console.log('Prodotti Master File:', totalMaster);
        console.log('Record OutputShopify:', totalOutput);
        console.log('Con Metafields:', withMeta);
        console.log('');
        console.log('Stati:');
        console.log('  ⏳ Pending (da caricare):', pending);
        console.log('  ✅ Uploaded (caricati):', uploaded);
        console.log('  ❌ Error:', errors);
        console.log('');

        // Prodotti caricati su Shopify
        const uploadedProducts = await prisma.outputShopify.findMany({
            where: {
                utenteId: SANTE_ID,
                statoCaricamento: 'uploaded',
                shopifyProductId: { not: null }
            },
            select: {
                id: true,
                title: true,
                sku: true,
                shopifyProductId: true,
                metafieldsJson: true
            },
            take: 5
        });

        console.log('='.repeat(80));
        console.log('✅ PRODOTTI CARICATI SU SHOPIFY');
        console.log('='.repeat(80));

        if (uploadedProducts.length === 0) {
            console.log('⚠️  NESSUN PRODOTTO CARICATO SU SHOPIFY!');
            console.log('');
            console.log('Possibili cause:');
            console.log('  1. La sincronizzazione non è ancora stata eseguita');
            console.log('  2. C\'è un errore nella sincronizzazione');
            console.log('  3. Le credenziali Shopify non sono configurate');
            console.log('');
        } else {
            console.log(`Totale prodotti su Shopify: ${uploaded}\n`);

            uploadedProducts.forEach((p, i) => {
                console.log(`${i + 1}. ${p.title}`);
                console.log(`   SKU: ${p.sku}`);
                console.log(`   Shopify ID: ${p.shopifyProductId}`);

                if (p.metafieldsJson) {
                    const meta = JSON.parse(p.metafieldsJson);
                    console.log(`   Metafields: ${Object.keys(meta).length}`);

                    // Mostra i metafields chiave
                    const importantKeys = [
                        'custom.processore_brand',
                        'custom.ram',
                        'custom.capacita_ssd',
                        'custom.scheda_video'
                    ];

                    importantKeys.forEach(key => {
                        if (meta[key]) {
                            console.log(`   ✓ ${key.replace('custom.', '')}: ${meta[key].substring(0, 40)}...`);
                        }
                    });
                } else {
                    console.log(`   ⚠️  Nessun metafield`);
                }
                console.log('');
            });
        }

        // Verifica configurazione Shopify
        console.log('='.repeat(80));
        console.log('🔧 CONFIGURAZIONE SHOPIFY');
        console.log('='.repeat(80));

        const shopifyConfig = await prisma.configurazioneSistema.findMany({
            where: {
                utenteId: SANTE_ID,
                chiave: { in: ['SHOPIFY_SHOP_URL', 'SHOPIFY_ACCESS_TOKEN'] }
            }
        });

        const hasShopUrl = shopifyConfig.some(c => c.chiave === 'SHOPIFY_SHOP_URL' && c.valore);
        const hasToken = shopifyConfig.some(c => c.chiave === 'SHOPIFY_ACCESS_TOKEN' && c.valore);

        console.log('Shop URL configurato:', hasShopUrl ? '✅' : '❌');
        console.log('Access Token configurato:', hasToken ? '✅' : '❌');
        console.log('');

        if (!hasShopUrl || !hasToken) {
            console.log('⚠️  CREDENZIALI SHOPIFY MANCANTI!');
            console.log('');
            console.log('Per sincronizzare con Shopify devi configurare:');
            console.log('  1. SHOPIFY_SHOP_URL');
            console.log('  2. SHOPIFY_ACCESS_TOKEN');
            console.log('');
            console.log('Vai su Price Manager → Impostazioni → Shopify');
        }

        await prisma.$disconnect();

    } catch (error: any) {
        console.error('❌ Errore:', error.message);
        await prisma.$disconnect();
    }
}

checkShopifyStatus();
