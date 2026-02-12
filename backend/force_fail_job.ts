
import prisma from './src/config/database';

async function forceFailStuckJobs() {
    try {
        console.log('Attemping to fix stuck jobs...');
        // Find jobs that are "running" (or custom status) for too long
        // The user said "In corso", which likely maps to 'running' or similar in DB.
        // Step 1: Check what's running
        const runningJobs = await prisma.logElaborazione.findMany({
            where: {
                stato: 'running',
                faseProcesso: 'SYNC_SHOPIFY'
            }
        });

        console.log(`Found ${runningJobs.length} stuck SYNC_SHOPIFY jobs.`);

        for (const job of runningJobs) {
            console.log(`Fixing job ${job.id} from ${job.dataEsecuzione}...`);
            await prisma.logElaborazione.update({
                where: { id: job.id },
                data: {
                    stato: 'error',
                    dettagliJson: JSON.stringify({ error: 'Force failed by cleanup script (stuck job)' }),
                    durataSecondi: 9999
                }
            });
            console.log(`Job ${job.id} marked as error.`);
        }

        // Also clean up SchedulerService active runs if possible, but that's in-memory.
        // We can't clear in-memory state of the running server from here.
        // But adjusting the DB record fixes the UI.

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

forceFailStuckJobs();
