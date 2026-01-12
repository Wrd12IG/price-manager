import { PrismaClient } from '@prisma/client';
import { ShopifyService } from '../services/ShopifyService';

const prisma = new PrismaClient();

async function prepareSingleProduct() {
    const ean = '4711387252970';

    try {
        console.log(`=== PREPARING PRODUCT ${ean} FOR SHOPIFY ===\n`);

        // 1. Get MasterFile ID
        const masterProduct = await prisma.masterFile.findUnique({
            where: { eanGtin: ean }
        });

        if (!masterProduct) {
            console.log('❌ Product not found in MasterFile');
            return;
        }

        console.log(`Found MasterFile ID: ${masterProduct.id}`);

        // 2. Run prepareExport logic manually for this product
        // We can't easily call ShopifyService.prepareExport for a single ID if it's not exposed,
        // but we can simulate it or call the API.
        // Let's assume we want to see the result, so we'll use the service if possible or just trigger the full prepare
        // Since prepareExport processes everything not yet processed or updated, we can just run it.

        // But first, let's make sure this product is marked as needing update if it exists
        const existingOutput = await prisma.outputShopify.findUnique({
            where: { masterFileId: masterProduct.id }
        });

        if (existingOutput) {
            console.log('Product already in OutputShopify, deleting to force re-creation...');
            await prisma.outputShopify.delete({
                where: { id: existingOutput.id }
            });
        }

        console.log('Running ShopifyService.prepareExport()...');
        const count = await ShopifyService.prepareExport();

        console.log('\n✅ Prepare completed!');
        console.log(`Processed: ${count}`);

        // 3. Check the result
        const output = await prisma.outputShopify.findUnique({
            where: { masterFileId: masterProduct.id }
        });

        if (output) {
            console.log('\n=== GENERATED SHOPIFY DATA ===');
            console.log(`Title: ${output.title}`);
            console.log(`Handle: ${output.handle}`);

            if (output.metafieldsJson) {
                const metafields = JSON.parse(output.metafieldsJson);
                console.log(`\n✅ Generated ${metafields.length} metafields:`);

                metafields.forEach((mf: any) => {
                    console.log(`  - ${mf.namespace}.${mf.key}: ${mf.value.substring(0, 50)}${mf.value.length > 50 ? '...' : ''}`);
                });
            } else {
                console.log('❌ No metafields generated!');
            }
        } else {
            console.log('❌ Product still not in OutputShopify!');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

prepareSingleProduct();
