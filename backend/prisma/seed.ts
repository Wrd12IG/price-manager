import prisma from '../src/config/database';

async function seed() {
    try {
        console.log('🌱 Inizio seeding database...');

        // 0. Utente Admin
        const adminEmail = 'roberto@wrdigital.it';
        const passwordHash = await require('bcryptjs').hash('Wrdigital12$', 10);
        const admin = await prisma.utente.upsert({
            where: { email: adminEmail },
            update: {},
            create: {
                nome: 'Admin',
                cognome: 'WR Digital',
                email: adminEmail,
                passwordHash: passwordHash,
                ruolo: 'admin',
                attivo: true
            }
        });

        console.log(`✅ Utente Admin: ${admin.email}`);

        // 1. Fornitore demo (associato all'admin)
        const fornitore = await (prisma.fornitore as any).upsert({
            where: { utenteId_nomeFornitore: { utenteId: admin.id, nomeFornitore: 'Fornitore Demo' } },
            update: {},
            create: {
                utenteId: admin.id,
                nomeFornitore: 'Fornitore Demo',
                urlListino: 'https://example.com/listino.csv',
                formatoFile: 'csv',
                tipoAccesso: 'direct_url',
                attivo: true,
                frequenzaAggiornamento: 'daily',
                encoding: 'UTF-8',
                separatoreCSV: ';'
            }
        });

        console.log(`✅ Fornitore: ${fornitore.nomeFornitore}`);

        // 2. Regola markup default (per l'admin)
        const markup = await (prisma.regolaMarkup as any).upsert({
            where: { id: 1 },
            update: {},
            create: {
                utenteId: admin.id,
                tipoRegola: 'default',
                riferimento: null,
                markupPercentuale: 30.0,
                markupFisso: 0,
                costoSpedizione: 0,
                priorita: 4,
                attiva: true
            }
        });

        console.log(`✅ Markup default: ${markup.markupPercentuale}%`);

        console.log('🎉 Seeding completato!');
    } catch (error) {
        console.error('❌ Errore:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

seed();
