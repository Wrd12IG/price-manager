import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProductStatus(utenteId: number) {
    try {
        console.log(`--- PRODUCT STATUS FOR USER ${utenteId} ---`);

        const masterFileCount = await prisma.masterFile.count({ where: { utenteId } });
        console.log(`Total products in MasterFile: ${masterFileCount}`);

        const outputShopifyTotal = await prisma.outputShopify.count({ where: { utenteId } });
        console.log(`Total products in OutputShopify: ${outputShopifyTotal}`);

        const pendingUpload = await prisma.outputShopify.count({
            where: { utenteId, statoCaricamento: 'pending' }
        });
        console.log(`Products pending upload (pending): ${pendingUpload}`);

        const uploaded = await prisma.outputShopify.count({
            where: { utenteId, statoCaricamento: 'uploaded' }
        });
        console.log(`Products already uploaded (uploaded): ${uploaded}`);

        const errors = await prisma.outputShopify.count({
            where: { utenteId, statoCaricamento: 'error' }
        });
        console.log(`Products with errors (error): ${errors}`);

    } catch (e) {
        console.error('Check Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

// Check for both user 1 and 2 to be sure
(async () => {
    await checkProductStatus(1);
    await checkProductStatus(2);
})();
