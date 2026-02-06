import prisma from './src/config/database';

async function verify() {
    console.log('🔍 Verifica tabelle SANTE (ID 2)...\n');

    // Conta tabelle per stato
    const totalSante = await prisma.outputShopify.count({
        where: { utenteId: 2 }
    });

    console.log(`📊 Totale prodotti SANTE: ${totalSante}`);

    // Conta pending (da sincronizzare)
    const pendingSante = await prisma.outputShopify.count({
        where: { utenteId: 2, statoCaricamento: 'pending' }
    });

    console.log(`⏳ Prodotti pending (da sincronizzare): ${pendingSante}`);

    // Campione di prodotti fixati
    const sample = await prisma.outputShopify.findMany({
        where: {
            utenteId: 2,
            statoCaricamento: 'pending'
        },
        take: 5,
        select: {
            title: true,
            metafieldsJson: true
        }
    });

    console.log('\n📦 Campione prodotti pending con tabella:');
    for (const p of sample) {
        if (p.metafieldsJson) {
            const meta = JSON.parse(p.metafieldsJson);
            const table = meta['custom.tabella_specifiche'];
            console.log(`   ${p.title?.substring(0, 40)} -> ${table?.length || 0} chars`);
        }
    }

    await prisma.$disconnect();
    console.log('\n✅ Verifica completata');
}

verify();
