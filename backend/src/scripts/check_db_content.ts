import prisma from '../config/database';

async function checkDB() {
    try {
        const count = await prisma.masterFile.count();
        console.log('Total MasterFile products:', count);

        const brands = await prisma.masterFile.groupBy({
            by: ['marca'],
            _count: { marca: true },
            orderBy: { _count: { marca: 'desc' } },
            take: 10
        });

        console.log('Top brands:', brands);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkDB();
