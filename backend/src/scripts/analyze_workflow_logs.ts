import prisma from '../config/database';

async function analyzeLogs() {
    console.log('📊 Analisi LogElaborazione - Verifica Email Duplicate\n');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const logs = await prisma.logElaborazione.findMany({
        where: {
            dataEsecuzione: { gte: yesterday }
        },
        orderBy: { dataEsecuzione: 'desc' }
    });

    console.log(`Totale log trovati (ultime 24h): ${logs.length}\n`);

    // Raggruppa per utente e fase
    const byUser: Record<number, { total: number; fasi: Record<string, number> }> = {};

    for (const log of logs) {
        if (!byUser[log.utenteId]) {
            byUser[log.utenteId] = {
                total: 0,
                fasi: {}
            };
        }
        byUser[log.utenteId].total++;

        if (!byUser[log.utenteId].fasi[log.faseProcesso]) {
            byUser[log.utenteId].fasi[log.faseProcesso] = 0;
        }
        byUser[log.utenteId].fasi[log.faseProcesso]++;
    }

    for (const [uid, data] of Object.entries(byUser)) {
        console.log(`\nUtente ${uid}:`);
        console.log(`  Totale esecuzioni: ${data.total}`);
        console.log(`  Per fase:`);
        for (const [fase, count] of Object.entries(data.fasi)) {
            console.log(`    - ${fase}: ${count}`);
        }
    }

    // Mostra gli ultimi 20 workflow completi
    console.log(`\n\n📋 Ultimi 20 Workflow Completi:\n`);
    const workflows = logs.filter(l => l.faseProcesso === 'WORKFLOW_COMPLETO').slice(0, 20);

    for (const wf of workflows) {
        const date = wf.dataEsecuzione.toISOString().split('T');
        const time = date[1].substring(0, 8);
        console.log(`[${date[0]} ${time}] Utente ${wf.utenteId} - ${wf.stato} - ${wf.durataSecondi || 0}s`);
    }

    // Conta workflow per utente nelle ultime 24h
    console.log(`\n\n📅 Workflow Completi per Utente (ultime 24h):\n`);
    const wfByUser: Record<number, number> = {};

    for (const wf of workflows) {
        if (!wfByUser[wf.utenteId]) wfByUser[wf.utenteId] = 0;
        wfByUser[wf.utenteId]++;
    }

    for (const [uid, count] of Object.entries(wfByUser)) {
        console.log(`  Utente ${uid}: ${count} workflow completi`);
        if (count > 5) {
            console.log(`    ⚠️ ATTENZIONE: Più di 5 workflow in 24h!`);
        }
    }

    await prisma.$disconnect();
}

analyzeLogs();
