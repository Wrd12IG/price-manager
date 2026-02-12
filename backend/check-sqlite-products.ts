import { PrismaClient } from '@prisma/client';

async function investigateSqlite() {
    const dbPath = 'file:/Users/wrdigital/.gemini/antigravity/scratch/ecommerce-price-manager/backend/prisma/dev.db';
    console.log(`🔍 Investigating SQLite database at: ${dbPath}`);

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: dbPath
            }
        }
    });

    const targetPartNumbers = [
        'S5606CA-RI068W',
        'FA808UP-S9023W',
        'B3605CCA-MB0062X',
        'P1403CVA-S61680X'
    ];

    try {
        await prisma.$connect();
        console.log('✅ Connected to SQLite.');

        for (const pn of targetPartNumbers) {
            console.log('='.repeat(50));
            console.log(`📦 Prodotto: ${pn}`);

            const product = await prisma.masterFile.findFirst({
                where: {
                    partNumber: { contains: pn }
                },
                include: {
                    datiIcecat: true,
                    outputShopify: true
                }
            });

            if (!product) {
                console.log('❌ Prodotto non trovato in SQLite');
                continue;
            }

            console.log(`ID: ${product.id}`);
            console.log(`Nome: ${product.nomeProdotto}`);
            console.log(`ICEcat presente: ${product.datiIcecat ? '✅' : '❌'}`);

            if (product.outputShopify) {
                const metafields = JSON.parse(product.outputShopify.metafieldsJson || '{}');
                const hasTable = !!metafields['custom.tabella_specifiche'];
                console.log(`Tabella in OutputShopify: ${hasTable ? '✅' : '❌'}`);

                if (!hasTable) {
                    console.log('📋 Metafields presenti:', Object.keys(metafields));
                }
            } else {
                console.log('Record OutputShopify: ❌');
            }
        }

        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Errore:', error.message);
    }
}

investigateSqlite();
