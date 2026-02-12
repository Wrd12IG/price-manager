import prisma from './src/config/database';

async function findSanteUser() {
    try {
        const users = await prisma.utente.findMany({
            where: {
                email: {
                    contains: 'sante',
                    mode: 'insensitive'
                }
            }
        });

        if (users.length === 0) {
            console.log('❌ Nessun utente trovato con email contenente "sante"');

            // Mostra tutti gli utenti
            const allUsers = await prisma.utente.findMany({
                select: {
                    id: true,
                    email: true,
                    nome: true
                }
            });

            console.log('\n📋 Utenti disponibili:');
            allUsers.forEach(u => {
                console.log(`  - ID: ${u.id}, Email: ${u.email}, Nome: ${u.nome}`);
            });
        } else {
            console.log('✅ Utente SANTE trovato:\n');
            users.forEach(u => {
                console.log(`ID: ${u.id}`);
                console.log(`Email: ${u.email}`);
                console.log(`Nome: ${u.nome}`);
            });
        }

        await prisma.$disconnect();
    } catch (error: any) {
        console.error('Errore:', error.message);
        await prisma.$disconnect();
    }
}

findSanteUser();
