import prisma from './src/config/database';

async function checkMasterFile() {
    try {
        console.log('🔍 Checking MasterFile for Sante...');
        const stats = await prisma.masterFile.groupBy({
            by: ['fornitoreSelezionatoId'],
            where: { utenteId: 2 },
            _count: true
        });

        console.log('📊 Products by Supplier for Sante:');
        for (const s of stats) {
            const fornitore = await prisma.fornitore.findUnique({ where: { id: s.fornitoreSelezionatoId } });
            console.log(`- ${fornitore?.nomeFornitore || 'Unknown'}: ${s._count} products`);
        }

        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkMasterFile();
