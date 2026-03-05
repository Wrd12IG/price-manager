import { ShopifyService } from './src/services/ShopifyService';
import { logger } from './src/utils/logger';
import prisma from './src/config/database';

async function runTest() {
    const utenteId = 2; // sante.dormio@gmail.com

    try {
        console.log(`--- STARTING MANUAL SYNC TEST FOR USER ${utenteId} ---`);

        // Verifichiamo se ci sono prodotti da sincronizzare
        const pendingCount = await prisma.outputShopify.count({
            where: { utenteId, statoCaricamento: 'pending' }
        });
        console.log(`Pending products: ${pendingCount}`);

        // Avviamo il sync
        console.log('Triggering ShopifyService.syncProducts...');
        const result = await ShopifyService.syncProducts(utenteId);

        console.log('Sync completed result:', result);
    } catch (e) {
        console.error('Manual Sync Error:', e);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

runTest();
