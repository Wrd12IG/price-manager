
import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DIRECT_URL // Try direct connection
        }
    }
});

async function checkStatus() {
    try {
        console.log('Testing DIRECT connection...');
        const count = await prisma.logElaborazione.count();
        console.log(`Connection successful! Found ${count} logs.`);

        const recentJobs = await prisma.logElaborazione.findMany({
            take: 5,
            orderBy: { dataEsecuzione: 'desc' },
            select: { id: true, stato: true, faseProcesso: true, dataEsecuzione: true }
        });
        console.log('Recent jobs:', recentJobs);

    } catch (e) {
        console.error('Connection failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

checkStatus();
