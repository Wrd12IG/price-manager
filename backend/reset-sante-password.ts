import prisma from './src/config/database';
import bcrypt from 'bcryptjs';

async function resetSantePassword() {
    try {
        const newPassword = 'sante123'; // Password temporanea
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const updated = await prisma.utente.update({
            where: { email: 'sante.dormio@gmail.com' },
            data: { passwordHash: hashedPassword }
        });

        console.log('✅ Password reimpostata per Sante');
        console.log('Email:', updated.email);
        console.log('Nuova password:', newPassword);
        console.log('');
        console.log('🌐 Puoi ora accedere a:');
        console.log('   URL: http://localhost:5173');
        console.log('   Email: sante.dormio@gmail.com');
        console.log('   Password:', newPassword);

        await prisma.$disconnect();
    } catch (error: any) {
        console.error('Errore:', error.message);
        await prisma.$disconnect();
    }
}

resetSantePassword();
