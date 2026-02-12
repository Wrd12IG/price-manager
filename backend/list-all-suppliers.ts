import prisma from './src/config/database';

async function listAllSuppliers() {
    try {
        console.log('🔍 Listing all suppliers in DB...');
        const suppliers = await prisma.fornitore.findMany({
            include: { utente: true }
        });

        suppliers.forEach(s => {
            console.log(`ID: ${s.id}, Name: ${s.nomeFornitore}, User: ${s.utente.email}, Active: ${s.attivo}`);
        });

        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

listAllSuppliers();
