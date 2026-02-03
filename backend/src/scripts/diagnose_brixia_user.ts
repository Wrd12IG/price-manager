import prisma from '../config/database';

async function checkBrixiaUser() {
    console.log('🔍 Ricerca utente Brixia Test...\n');

    // Cerca utente
    const utente = await prisma.utente.findFirst({
        where: {
            OR: [
                { nome: { contains: 'Brixia', mode: 'insensitive' } },
                { email: { contains: 'brixia', mode: 'insensitive' } },
                { nome: { contains: 'Test', mode: 'insensitive' } }
            ]
        }
    });

    if (!utente) {
        console.log('❌ Utente Brixia Test non trovato\n');

        // Mostra tutti gli utenti
        const allUsers = await prisma.utente.findMany({
            select: { id: true, nome: true, email: true, attivo: true }
        });

        console.log('📋 Utenti disponibili:');
        for (const u of allUsers) {
            console.log(`   ${u.id}. ${u.nome} (${u.email}) - ${u.attivo ? '✅' : '❌'}`);
        }

        await prisma.$disconnect();
        return;
    }

    console.log(`✅ Trovato: ${utente.nome} (ID: ${utente.id})`);
    console.log(`   Email: ${utente.email}`);
    console.log(`   Attivo: ${utente.attivo ? '✅' : '❌'}\n`);

    // Controlla listini (Fornitori, non ConfigurazioneFornitori)
    console.log('📦 Listini (Fornitori) configurati:\n');

    const listini = await prisma.fornitore.findMany({
        where: { utenteId: utente.id }
    });

    if (listini.length === 0) {
        console.log('   ⚠️ Nessun listino configurato\n');
    } else {
        for (const l of listini) {
            console.log(`   - ${l.nomeFornitore} (ID: ${l.id})`);
            console.log(`     Attivo: ${l.attivo ? '✅' : '❌'}\n`);
        }
    }

    // Controlla MasterFile
    console.log('📊 MasterFile:\n');

    const totalProdotti = await prisma.masterFile.count({
        where: { utenteId: utente.id }
    });

    console.log(`   Prodotti totali: ${totalProdotti}`);

    // Conta per marchio ASUS (via relazione)
    const asusByMarchioId = await prisma.masterFile.count({
        where: {
            utenteId: utente.id,
            marchioId: { not: null },
            marchio: {
                nome: { contains: 'ASUS', mode: 'insensitive' }
            }
        }
    });

    console.log(`   Prodotti ASUS (via marchioId): ${asusByMarchioId}`);

    // Mostra sample prodotti ASUS
    if (asusByMarchioId > 0) {
        const samples = await prisma.masterFile.findMany({
            where: {
                utenteId: utente.id,
                marchioId: { not: null },
                marchio: {
                    nome: { contains: 'ASUS', mode: 'insensitive' }
                }
            },
            take: 3,
            select: {
                id: true,
                nomeProdotto: true,
                marchio: { select: { nome: true } },
                eanGtin: true
            }
        });

        console.log('\n   📦 Sample prodotti ASUS:');
        for (const s of samples) {
            console.log(`      - ${s.nomeProdotto?.substring(0, 50)} (${s.marchio?.nome})`);
        }
    } else {
        console.log('   ⚠️ Nessun prodotto ASUS trovato tramite relazione marchio');

        // Proviamo a cercare nel nome prodotto
        const asusByName = await prisma.masterFile.count({
            where: {
                utenteId: utente.id,
                nomeProdotto: { contains: 'ASUS', mode: 'insensitive' }
            }
        });

        console.log(`   Prodotti con "ASUS" nel nome: ${asusByName}`);
    }

    // Top marchi (via relazione)
    const topBrands: any = await prisma.$queryRaw`
        SELECT m.nome as marchio, COUNT(*) as count
        FROM "MasterFile" mf
        LEFT JOIN "Marchio" m ON mf."marchioId" = m.id
        WHERE mf."utenteId" = ${utente.id}
        AND m.nome IS NOT NULL
        GROUP BY m.nome
        ORDER BY count DESC
        LIMIT 15
    `;

    console.log('\n   🏷️ Top 15 marchi:');
    for (const b of topBrands) {
        const count = parseInt(b.count);
        console.log(`      ${b.marchio}: ${count} prodotti`);
    }

    // Conta quanti prodotti NON hanno marchio assegnato
    const noMarchio = await prisma.masterFile.count({
        where: {
            utenteId: utente.id,
            marchioId: null
        }
    });

    console.log(`\n   ⚠️  Prodotti senza marchio assegnato: ${noMarchio}`);

    await prisma.$disconnect();
}

checkBrixiaUser().catch(err => {
    console.error('❌ Errore:', err.message);
    process.exit(1);
});
