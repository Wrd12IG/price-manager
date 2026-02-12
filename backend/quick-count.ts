import prisma from './src/config/database';

async function countEverything() {
    try {
        console.log('🔍 Quick check of database counts...');
        const userCount = await prisma.utente.count();
        const fornitoreCount = await prisma.fornitore.count();
        const productCount = await prisma.masterFile.count();
        const listinoCount = await prisma.listinoRaw.count();

        console.log(`- Utenti: ${userCount}`);
        console.log(`- Fornitori: ${fornitoreCount}`);
        console.log(`- MasterFile Products: ${productCount}`);
        console.log(`- Raw Listini Items: ${listinoCount}`);

        const sante = await prisma.utente.findUnique({ where: { email: 'sante.dormio@gmail.com' } });
        if (sante) {
            const santeFornitori = await prisma.fornitore.findMany({ where: { utenteId: sante.id } });
            console.log(`\n👨‍💼 Suppliers for Sante (${sante.id}): ${santeFornitori.length}`);
            santeFornitori.forEach(f => console.log(`  - ${f.nomeFornitore} (ID: ${f.id})`));
        }

        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

countEverything();
