
import prisma from '../config/database';
import { logger } from '../utils/logger';

async function cleanMasterFile() {
    logger.info('Inizio pulizia Master File e Output Shopify...');

    try {
        const deletedOutput = await prisma.outputShopify.deleteMany({});
        logger.info(`Eliminati ${deletedOutput.count} record da OutputShopify.`);

        const deletedMaster = await prisma.masterFile.deleteMany({});
        logger.info(`Eliminati ${deletedMaster.count} record da MasterFile.`);

        logger.info('Pulizia completata con successo.');
    } catch (error) {
        logger.error('Errore durante la pulizia:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanMasterFile();
