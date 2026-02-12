
// Load env before everything else
import dotenv from 'dotenv';
import path from 'path';

// Load .env explicitly
dotenv.config({ path: path.join(__dirname, '.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function forceFailStuckJobs() {
    try {
        console.log('Attemping to fix stuck jobs...');

        // Find jobs that are "running" (or custom status) for too long
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
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

forceFailStuckJobs();
