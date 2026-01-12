
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkListinoRaw() {
    console.log('--- Checking ListinoRaw Brands ---');

    const total = await prisma.listinoRaw.count();
    console.log(`Total ListinoRaw items: ${total}`);

    const brands = await prisma.listinoRaw.findMany({
        select: { marca: true },
        distinct: ['marca'],
        take: 50
    });

    console.log('ListinoRaw brands sample:', brands.map(b => b.marca));

    await prisma.$disconnect();
}

checkListinoRaw();
