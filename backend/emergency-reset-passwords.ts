import prisma from './src/config/database';
import bcrypt from 'bcryptjs';

/**
 * Script di emergenza per resettare le password degli utenti
 */

async function resetAllPasswords() {
    try {
        console.log('🔧 RESET PASSWORD UTENTI PRICE MANAGER\n');
        console.log('='.repeat(80));

        // Nuova password per tutti
        const newPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Trova tutti gli utenti
        const users = await prisma.utente.findMany({
            select: {
                id: true,
                email: true,
                nome: true,
                ruolo: true
            }
        });

        console.log(`Trovati ${users.length} utenti:\n`);

        for (const user of users) {
            console.log(`📧 ${user.email}`);
            console.log(`   Nome: ${user.nome}`);
            console.log(`   Ruolo: ${user.ruolo}`);
            console.log(`   ID: ${user.id}`);

            // Aggiorna password
            await prisma.utente.update({
                where: { id: user.id },
                data: { passwordHash: hashedPassword }
            });

            console.log(`   ✅ Password reimpostata\n`);
        }

        console.log('='.repeat(80));
        console.log('✅ TUTTE LE PASSWORD SONO STATE REIMPOSTATE!\n');
        console.log('🔑 NUOVE CREDENZIALI:\n');
        console.log('Password per TUTTI gli utenti:', newPassword);
        console.log('\nPuoi ora accedere con:');

        users.forEach(u => {
            console.log(`  • ${u.email} / ${newPassword}`);
        });

        console.log('\n🌐 URL Login: http://localhost:5173/login');
        console.log('\n⚠️  IMPORTANTE: Cambia le password dopo aver effettuato l\'accesso!');
        console.log('='.repeat(80));

        await prisma.$disconnect();

    } catch (error: any) {
        console.error('\n❌ ERRORE:', error.message);
        console.error('Stack:', error.stack);
        await prisma.$disconnect();
        process.exit(1);
    }
}

resetAllPasswords();
