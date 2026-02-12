import prisma from './src/config/database';

async function checkUsers() {
    try {
        console.log('🔍 Checking users...');
        const users = await prisma.utente.findMany({
            select: {
                id: true,
                email: true,
                passwordHash: true,
                attivo: true,
                ruolo: true
            }
        });
        console.log('👥 Users found:', JSON.stringify(users, null, 2));
        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkUsers();
