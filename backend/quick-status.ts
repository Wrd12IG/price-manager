import prisma from './src/config/database';

async function checkStatus() {
    try {
        const stats = await prisma.outputShopify.aggregate({
            where: { utenteId: 2 },
            _count: { id: true }
        });

        const withMeta = await prisma.outputShopify.count({
            where: {
                utenteId: 2,
                metafieldsJson: { not: null }
            }
        });

        const total = await prisma.masterFile.count({
            where: { utenteId: 2 }
        });

        console.log('📊 Stato Export Sante:');
        console.log('Totale prodotti:', total);
        console.log('Record OutputShopify:', stats._count.id);
        console.log('Con metafields:', withMeta);
        console.log('Percentuale:', Math.round((stats._count.id / total) * 100) + '%');

        await prisma.$disconnect();
    } catch (error) {
        console.error('Errore:', error);
        await prisma.$disconnect();
    }
}

checkStatus();
