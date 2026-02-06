import prisma from '../config/database';

async function healthCheck() {
    console.log('🔍 Health Check Price Manager\n');

    // 1. Database Connection
    try {
        await prisma.$queryRaw`SELECT 1`;
        console.log('✅ Database: Connessione OK');
    } catch (e: any) {
        console.log('❌ Database: Errore connessione -', e.message);
        return;
    }

    // 2. Utenti
    const totalUsers = await prisma.utente.count();
    const activeUsers = await prisma.utente.count({ where: { attivo: true } });
    console.log(`✅ Utenti: ${activeUsers}/${totalUsers} attivi`);

    // 3. Fornitori
    const totalFornitori = await prisma.fornitore.count();
    const activeFornitori = await prisma.fornitore.count({ where: { attivo: true } });
    console.log(`✅ Fornitori: ${activeFornitori}/${totalFornitori} attivi`);

    // 4. MasterFile
    const totalProducts = await prisma.masterFile.count();
    console.log(`✅ MasterFile: ${totalProducts} prodotti consolidati`);

    // 5. OutputShopify
    const shopifyProducts = await prisma.outputShopify.count();
    const shopifyUploaded = await prisma.outputShopify.count({
        where: { statoCaricamento: 'uploaded' }
    });
    console.log(`✅ Shopify: ${shopifyUploaded}/${shopifyProducts} prodotti caricati`);

    // 6. Icecat
    const icecatData = await prisma.datiIcecat.count();
    console.log(`✅ Icecat: ${icecatData} prodotti arricchiti`);

    // 7. Ultimi log
    const lastLogs = await prisma.logElaborazione.findMany({
        take: 3,
        orderBy: { dataEsecuzione: 'desc' },
        select: { faseProcesso: true, stato: true, dataEsecuzione: true }
    });

    console.log(`\n📋 Ultimi 3 log:`);
    lastLogs.forEach(log => {
        const icon = log.stato === 'success' ? '✅' : log.stato === 'error' ? '❌' : '⏳';
        const date = new Date(log.dataEsecuzione).toLocaleString('it-IT');
        console.log(`   ${icon} ${log.faseProcesso} - ${log.stato} (${date})`);
    });

    console.log(`\n🎉 Sistema operativo e funzionante!`);

    await prisma.$disconnect();
}

healthCheck().catch(e => {
    console.error('❌ Health check fallito:', e.message);
    process.exit(1);
});
