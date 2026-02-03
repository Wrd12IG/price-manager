import prisma from '../config/database';

async function checkWorkflowStatus() {
    console.log('📊 MONITORAGGIO WORKFLOW - Verifica Fix Email\n');
    console.log('='.repeat(60));

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    console.log(`\n🕐 Data verifica: ${now.toLocaleString('it-IT')}`);
    console.log(`📅 Analisi ultime 24 ore (da ${yesterday.toLocaleString('it-IT')})\n`);

    // Controlla workflow utente 2 (SANTE)
    const workflows = await prisma.logElaborazione.findMany({
        where: {
            utenteId: 2,
            faseProcesso: 'WORKFLOW_COMPLETO',
            dataEsecuzione: { gte: yesterday }
        },
        orderBy: { dataEsecuzione: 'desc' }
    });

    console.log('📋 WORKFLOW COMPLETI (Utente 2 - SANTE):\n');
    console.log(`   Totale esecuzioni: ${workflows.length}`);

    if (workflows.length === 0) {
        console.log('\n⚠️  Nessun workflow eseguito nelle ultime 24h');
        console.log('   Verifica che lo scheduler sia attivo.');
    } else {
        // Analisi dettagliata
        const successi = workflows.filter(w => w.stato === 'success').length;
        const errori = workflows.filter(w => w.stato === 'error').length;
        const running = workflows.filter(w => w.stato === 'running').length;

        console.log(`   ✅ Successi: ${successi}`);
        console.log(`   ❌ Errori: ${errori}`);
        console.log(`   ⏳ In corso: ${running}`);

        console.log('\n📝 Dettaglio esecuzioni:\n');

        for (const wf of workflows) {
            const date = wf.dataEsecuzione.toLocaleString('it-IT');
            const duration = wf.durataSecondi ? `${Math.round(wf.durataSecondi / 60)}min` : 'N/A';
            const icon = wf.stato === 'success' ? '✅' : wf.stato === 'error' ? '❌' : '⏳';

            console.log(`   ${icon} [${date}] - ${wf.stato.toUpperCase()} - ${duration}`);

            // Se c'è un errore, mostra i dettagli
            if (wf.stato === 'error' && wf.dettagliJson) {
                try {
                    const details = JSON.parse(wf.dettagliJson);
                    const errorMsg = details.error || 'Errore sconosciuto';
                    console.log(`      └─ Errore: ${errorMsg.substring(0, 80)}...`);
                } catch (e) {
                    // Ignore parse errors
                }
            }
        }

        // Valutazione fix
        console.log('\n' + '='.repeat(60));
        console.log('\n🎯 VALUTAZIONE FIX:\n');

        if (workflows.length === 1 && successi === 1) {
            console.log('✅✅✅ PERFETTO! Fix funziona al 100%');
            console.log('   - 1 workflow eseguito (come previsto)');
            console.log('   - Completato con successo');
            console.log('   - 1 email di conferma inviata a help@computer.it');
            console.log('\n🎉 Problema email RISOLTO!');
        } else if (workflows.length === 1 && errori === 1) {
            console.log('⚠️  Fix parziale - Workflow eseguito ma con errore');
            console.log('   Controlla i dettagli sopra per identificare il problema.');
        } else if (workflows.length > 5) {
            console.log('❌ Fix NON funzionante - Troppe esecuzioni');
            console.log(`   Trovate ${workflows.length} esecuzioni invece di 1`);
            console.log('   Il workflow continua a fallire e ripartire.');
        } else if (workflows.length > 1) {
            console.log('⚠️  Fix parziale - Esecuzioni multiple');
            console.log(`   Trovate ${workflows.length} esecuzioni invece di 1`);
            console.log(`   Di cui ${errori} errori`);
        }

        // Email inviate (stima)
        console.log(`\n📧 Email inviate (stimate): ${workflows.length}`);
        console.log(`   Destinatario: help@computer.it`);
    }

    // Controlla timeout database
    console.log('\n' + '='.repeat(60));
    console.log('\n⏱️  TIMEOUT DATABASE:\n');

    const timeout: any = await prisma.$queryRaw`SHOW statement_timeout`;
    const timeoutValue = timeout[0]?.statement_timeout;
    console.log(`   statement_timeout: ${timeoutValue}`);

    if (timeoutValue === '30min' || timeoutValue === '1800000ms') {
        console.log('   ✅ Configurato correttamente');
    } else {
        console.log('   ⚠️  Valore non ottimale (raccomandato: 30min)');
    }

    // Controlla email configurata
    console.log('\n📬 EMAIL NOTIFICA:\n');

    const emailConfig = await prisma.configurazioneSistema.findFirst({
        where: { utenteId: 2, chiave: 'notification_email' }
    });

    if (emailConfig) {
        console.log(`   Email configurata: ${emailConfig.valore}`);
        console.log('   ✅ Configurazione OK');
    } else {
        console.log('   ⚠️  Email non configurata - usa email account');
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Monitoraggio completato\n');

    await prisma.$disconnect();
}

checkWorkflowStatus().catch(err => {
    console.error('❌ Errore:', err);
    process.exit(1);
});
