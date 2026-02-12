
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Searching for Sante (utenteId=2) logs around 05:49...');

        // Find the specific log entry
        const logs = await prisma.logElaborazione.findMany({
            where: {
                utenteId: 2,
                faseProcesso: 'SYNC_SHOPIFY',
                OR: [
                    { stato: 'warning' },
                    { stato: 'error' }
                ]
            },
            orderBy: { dataEsecuzione: 'desc' },
            take: 5
        });

        console.log('Found logs:', JSON.stringify(logs, null, 2));

        // Check if there are any other logs around that time to see context
        if (logs.length > 0) {
            const targetLog = logs[0];
            const time = new Date(targetLog.dataEsecuzione);
            const start = new Date(time.getTime() - 1000 * 60 * 60 * 3); // 3 hours before
            const end = new Date(time.getTime() + 1000 * 60 * 60 * 1); // 1 hour after

            const contextLogs = await prisma.logElaborazione.findMany({
                where: {
                    utenteId: 2,
                    dataEsecuzione: {
                        gte: start,
                        lte: end
                    }
                },
                orderBy: { dataEsecuzione: 'asc' }
            });
            console.log('Context logs:', JSON.stringify(contextLogs.map(l => ({
                id: l.id,
                fase: l.faseProcesso,
                stato: l.stato,
                data: l.dataEsecuzione,
                urata: l.durataSecondi
            })), null, 2));
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
