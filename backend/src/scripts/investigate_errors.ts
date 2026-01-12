
import prisma from '../config/database';
import { logger } from '../utils/logger';

async function checkErrors() {
    try {
        console.log("Checking for errors in database...");

        // Check LogElaborazione
        const recentLogs = await prisma.logElaborazione.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10
        });
        console.log("\n--- Log Elaborazione (Last 10) ---");
        recentLogs.forEach(l => {
            console.log(`[${l.createdAt.toISOString()}] ${l.faseProcesso} - ${l.stato}: Processed=${l.prodottiProcessati}, Errors=${l.prodottiErrore}`);
            if (l.dettagliJson) console.log(`   Details: ${l.dettagliJson.substring(0, 200)}...`);
        });

        // Check OutputShopify errors
        const shopifyErrors = await prisma.outputShopify.count({
            where: { statoCaricamento: 'error' }
        });
        console.log(`\nOutputShopify Errors: ${shopifyErrors}`);

        if (shopifyErrors > 0) {
            const sampleErrors = await prisma.outputShopify.findMany({
                where: { statoCaricamento: 'error' },
                take: 5,
                select: { handle: true, errorMessage: true }
            });
            console.log("Sample Shopify Errors:", sampleErrors);
        }

        // Check MasterFile without EAN (unlikely given schema) or other issues
        const totalMaster = await prisma.masterFile.count();
        console.log(`\nTotal MasterFile: ${totalMaster}`);

    } catch (error) {
        console.error("Error checking DB:", error);
    } finally {
        await prisma.$disconnect();
    }
}

checkErrors();
