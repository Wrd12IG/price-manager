import prisma from '../config/database';

async function getLastErrors() {
    console.log('🔍 Analisi ultimi errori workflow Utente 2:\n');

    const errors = await prisma.logElaborazione.findMany({
        where: {
            utenteId: 2,
            stato: 'error'
        },
        orderBy: { dataEsecuzione: 'desc' },
        take: 5
    });

    for (const err of errors) {
        console.log(`\n❌ ${err.faseProcesso} - ${err.dataEsecuzione.toISOString()}`);
        if (err.dettagliJson) {
            try {
                const details = JSON.parse(err.dettagliJson);
                console.log(`   Errore: ${details.error || JSON.stringify(details).substring(0, 200)}`);
            } catch (e) {
                console.log(`   Dettagli: ${err.dettagliJson.substring(0, 200)}`);
            }
        }
    }

    await prisma.$disconnect();
}

getLastErrors();
