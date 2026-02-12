import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debug() {
    try {
        console.log('--- DEBUG DATABASE ---');
        const users = await prisma.utente.findMany({
            select: { id: true, email: true, ruolo: true, attivo: true }
        });
        console.log('Users:', users);

        const activeJobs = await prisma.logElaborazione.findMany({
            where: { stato: 'running' }
        });
        console.log('Active Jobs:', activeJobs);

        const shopifyConfigs = await prisma.configurazioneShopify.findMany();
        console.log('Shopify Configs count:', shopifyConfigs.length);

    } catch (e) {
        console.error('Debug Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

debug();
