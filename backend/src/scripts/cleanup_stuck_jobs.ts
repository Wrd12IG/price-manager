import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
    try {
        console.log('--- CLEANING STUCK JOBS ---');
        const result = await prisma.logElaborazione.updateMany({
            where: {
                stato: 'running',
                createdAt: {
                    lt: new Date(Date.now() - 30 * 60 * 1000) // Più vecchi di 30 minuti
                }
            },
            data: {
                stato: 'error',
                dettagliJson: 'Fermato automaticamente: timeout rilevato durante pulizia manuale'
            }
        });
        console.log(`✅ Puliti ${result.count} job bloccati.`);
    } catch (e) {
        console.error('Cleanup Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

cleanup();
