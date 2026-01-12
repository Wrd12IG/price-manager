import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPrices() {
    try {
        const products = await prisma.masterFile.findMany({
            take: 5,
            orderBy: { prezzoAcquistoMigliore: 'desc' }
        });

        for (const p of products) {
            console.log(`Product: ${p.nomeProdotto?.substring(0, 40)}...`);
            console.log(`  Purchase: €${p.prezzoAcquistoMigliore}`);
            console.log(`  Selling:  €${p.prezzoVenditaCalcolato}`);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkPrices();
