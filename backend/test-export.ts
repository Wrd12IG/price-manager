
import { ShopifyExportService } from './src/services/ShopifyExportService';
import prisma from './src/config/database';

async function testExport() {
    try {
        console.log('Testing Shopify Export generation...');
        const products = await ShopifyExportService.generateShopifyExport();
        console.log(`Successfully generated ${products.length} products for export.`);
        if (products.length > 0) {
            console.log('First product sample:', JSON.stringify(products[0], null, 2));
        }
    } catch (error) {
        console.error('Error during test export:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testExport();
