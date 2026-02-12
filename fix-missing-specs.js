
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// Import manually since we are running as a standalone node script
// We'll need to use the absolute paths for the transpiled JS files on the server
const { EnhancedMetafieldService } = require('./dist/services/EnhancedMetafieldService');

async function runFix() {
    console.log('Starting manual enrichment fix for Utente 2...');

    const products = await prisma.outputShopify.findMany({
        where: {
            utenteId: 2,
            OR: [
                { metafieldsJson: null },
                { metafieldsJson: { not: { contains: 'custom.tabella_specifiche' } } }
            ]
        },
        include: {
            masterFile: {
                include: {
                    marchio: true,
                    categoria: true,
                    datiIcecat: true
                }
            }
        }
    });

    console.log(`Found ${products.length} products needing enrichment.`);

    for (const p of products) {
        if (!p.masterFile) continue;

        console.log(`Enriching ${p.sku} (${p.title})...`);
        try {
            const metafieldsObj = await EnhancedMetafieldService.generateCompleteMetafields(
                2,
                {
                    id: p.masterFile.id,
                    eanGtin: p.masterFile.eanGtin,
                    partNumber: p.masterFile.partNumber,
                    nomeProdotto: p.masterFile.nomeProdotto,
                    marchio: p.masterFile.marchio,
                    categoria: p.masterFile.categoria,
                    datiIcecat: p.masterFile.datiIcecat
                }
            );

            if (Object.keys(metafieldsObj).length > 0) {
                await prisma.outputShopify.update({
                    where: { id: p.id },
                    data: {
                        metafieldsJson: JSON.stringify(metafieldsObj),
                        statoCaricamento: 'pending' // Mark as pending so sync-shopify will pick it up
                    }
                });
                console.log(`✅ Success for ${p.sku}`);
            } else {
                console.log(`⚠️ No data found for ${p.sku}`);
            }
        } catch (error) {
            console.error(`❌ Error for ${p.sku}:`, error.message);
        }

        // Sleep to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('Fix completed.');
    process.exit(0);
}

runFix();
