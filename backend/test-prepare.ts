
import { ShopifyService } from './src/services/ShopifyService';
import prisma from './src/config/database';

async function testPrepare() {
    try {
        console.log('Testing Shopify prepareExport...');
        const count = await ShopifyService.prepareExport();
        console.log(`Successfully prepared and saved ${count} products to OutputShopify.`);
    } catch (error) {
        console.error('Error during prepareExport:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testPrepare();
