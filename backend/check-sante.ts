import prisma from './src/config/database';

async function checkSante() {
    try {
        console.log('🔍 Checking sante.dormio@gmail.com...');
        const user = await prisma.utente.findUnique({
            where: { email: 'sante.dormio@gmail.com' },
            select: { id: true, email: true, passwordHash: true, attivo: true }
        });
        console.log('👤 User:', JSON.stringify(user, null, 2));
        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkSante();
