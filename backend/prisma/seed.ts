import prisma from '../src/config/database';

async function seed() {
    try {
        console.log('🌱 Inizio seeding database...');

        // 1. Fornitore demo
        const fornitore = await prisma.fornitore.upsert({
            where: { nomeFornitore: 'Fornitore Demo' },
            update: {},
            create: {
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

        // 2. Regola markup default
        const markup = await prisma.regolaMarkup.upsert({
            where: { id: 1 },
            update: {},
            create: {
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
