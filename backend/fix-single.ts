import prisma from './src/config/database';

async function updateSingle() {
    try {
        const hash = '$2a$12$GUzTjdkxwkE4pJreiqOms.7TIm1bEXopuhKCMJ1DDAfypRK6.FvS.';
        console.log('🏁 Updating sante.dormio@gmail.com...');
        const count = await prisma.$executeRaw`UPDATE utenti SET "passwordHash" = ${hash} WHERE email = 'sante.dormio@gmail.com'`;
        console.log('✅ Updated records:', count);
        await prisma.$disconnect();
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

updateSingle();
