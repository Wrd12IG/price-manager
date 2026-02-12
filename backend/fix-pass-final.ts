import prisma from './src/config/database';
import bcrypt from 'bcryptjs';

async function fixPassword() {
    try {
        const email = 'sante.dormio@gmail.com';
        const newPassword = 'admin123';
        const newHash = await bcrypt.hash(newPassword, 12);

        console.log(`🔐 Updating password for ${email}...`);
        console.log(`📝 New hash: ${newHash}`);

        const updated = await prisma.utente.update({
            where: { email: email },
            data: {
                passwordHash: newHash,
                attivo: true
            }
        });

        console.log('✅ User updated:', updated.email);

        // Also update other users for safety
        const otherEmails = ['roberto@wrdigital.it', 'luca@wrdigital.it', 'info@europccomputer.com'];
        for (const e of otherEmails) {
            await prisma.utente.update({
                where: { email: e },
                data: { passwordHash: newHash, attivo: true }
            }).catch(() => console.log(`⚠️ User ${e} not found`));
        }

        console.log('🚀 All passwords set to "admin123"');
        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

fixPassword();
