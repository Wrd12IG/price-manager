import prisma from './src/config/database';
import bcrypt from 'bcryptjs';

async function updateAndVerify() {
    try {
        const hash = await bcrypt.hash('admin123', 12);
        console.log('🏁 Hash generated:', hash);

        await prisma.$connect();
        console.log('✅ Connected.');

        const result = await prisma.utente.update({
            where: { email: 'sante.dormio@gmail.com' },
            data: { passwordHash: hash }
        });

        console.log('✅ Updated:', result.email);
        console.log('🔍 Double checking hash in DB...');

        const user = await prisma.utente.findUnique({
            where: { email: 'sante.dormio@gmail.com' },
            select: { passwordHash: true }
        });

        console.log('💾 Hash in DB now:', user.passwordHash);

        await prisma.$disconnect();
        console.log('👋 Done.');
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    }
}

updateAndVerify();
