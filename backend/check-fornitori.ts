import prisma from './src/config/database';

async function checkFornitori() {
    try {
        console.log('🔍 Checking suppliers for all users...');
        const suppliers = await prisma.fornitore.findMany({
            include: {
                utente: {
                    select: { email: true }
                }
            }
        });

        console.log('📋 Suppliers found:');
        suppliers.forEach(f => {
            console.log(`- [${f.utente.email}] ${f.nomeFornitore} (Attivo: ${f.attivo})`);
        });

        const santeSuppliers = suppliers.filter(s => s.utente.email === 'sante.dormio@gmail.com');
        console.log(`\n👨‍💼 Suppliers for Sante: ${santeSuppliers.length}`);
        santeSuppliers.forEach(f => console.log(`  - ${f.nomeFornitore}`));

        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkFornitori();
