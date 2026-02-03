import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeShopifyStatus() {
    try {
        console.log('\n🔍 ===== ANALISI DETTAGLIATA SHOPIFY SYNC =====\n');

        // 1. Stato generale OutputShopify
        const totalOutput = await prisma.outputShopify.count();
        const pending = await prisma.outputShopify.count({ where: { statoCaricamento: 'pending' } });
        const uploaded = await prisma.outputShopify.count({ where: { statoCaricamento: 'uploaded' } });
        const errors = await prisma.outputShopify.count({ where: { statoCaricamento: 'error' } });

        console.log('📊 STATO GENERALE:');
        console.log(`   Total records: ${totalOutput}`);
        console.log(`   ✅ Uploaded: ${uploaded} (${((uploaded / totalOutput) * 100).toFixed(1)}%)`);
        console.log(`   ⏳ Pending: ${pending} (${((pending / totalOutput) * 100).toFixed(1)}%)`);
        console.log(`   ❌ Errors: ${errors}`);

        // 2. Ultimi prodotti uploadati
        const lastUploaded = await prisma.outputShopify.findMany({
            where: { statoCaricamento: 'uploaded' },
            orderBy: { updatedAt: 'desc' },
            take: 5,
            select: { handle: true, title: true, updatedAt: true }
        });

        console.log('\n📤 ULTIMI 5 PRODOTTI CARICATI:');
        lastUploaded.forEach(p => {
            console.log(`   • ${p.title.substring(0, 50)} (${p.updatedAt.toISOString()})`);
        });

        // 3. Prodotti in pending
        const pendingProducts = await prisma.outputShopify.findMany({
            where: { statoCaricamento: 'pending' },
            orderBy: { createdAt: 'asc' },
            take: 5,
            select: { handle: true, title: true, createdAt: true, updatedAt: true }
        });

        console.log('\n⏳ PRIMI 5 PRODOTTI IN ATTESA:');
        pendingProducts.forEach(p => {
            console.log(`   • ${p.title.substring(0, 50)}`);
            console.log(`     Creato: ${p.createdAt.toISOString()}, Aggiornato: ${p.updatedAt.toISOString()}`);
        });

        // 4. Eventuali errori
        if (errors > 0) {
            const errorDetails = await prisma.outputShopify.findMany({
                where: { statoCaricamento: 'error' },
                take: 5,
                select: { handle: true, title: true, errorMessage: true, updatedAt: true }
            });
            console.log('\n❌ PRODOTTI CON ERRORI:');
            errorDetails.forEach(e => {
                console.log(`   • ${e.title.substring(0, 50)}`);
                console.log(`     Errore: ${e.errorMessage}`);
            });
        }

        // 5. Log elaborazione Shopify
        const shopifyLogs = await prisma.logElaborazione.findMany({
            where: {
                faseProcesso: { in: ['SYNC_SHOPIFY', 'EXPORT_SHOPIFY'] }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        console.log('\n📝 LOG ELABORAZIONE SHOPIFY (ultimi 10):');
        shopifyLogs.forEach(log => {
            console.log(`   [${log.createdAt.toISOString()}] ${log.faseProcesso} - ${log.stato}`);
            console.log(`      Processati: ${log.prodottiProcessati}, Errori: ${log.prodottiErrore}`);
            if (log.dettagliJson) {
                try {
                    const details = JSON.parse(log.dettagliJson);
                    console.log(`      Dettagli: ${JSON.stringify(details).substring(0, 100)}...`);
                } catch (e) {
                    console.log(`      Dettagli: ${log.dettagliJson.substring(0, 100)}...`);
                }
            }
        });

        // 6. Verifica configurazione Shopify
        const shopifyConfig = await prisma.configurazioneSistema.findMany({
            where: {
                chiave: { in: ['shopify_shop_url', 'shopify_access_token'] }
            }
        });

        console.log('\n⚙️ CONFIGURAZIONE SHOPIFY:');
        shopifyConfig.forEach(cfg => {
            if (cfg.chiave === 'shopify_shop_url') {
                console.log(`   Shop URL: ${cfg.valore || '❌ NON CONFIGURATO'}`);
            } else if (cfg.chiave === 'shopify_access_token') {
                console.log(`   Access Token: ${cfg.valore ? '✅ Configurato (encrypted)' : '❌ NON CONFIGURATO'}`);
            }
        });

        // 7. Statistiche temporali
        const oldestPending = await prisma.outputShopify.findFirst({
            where: { statoCaricamento: 'pending' },
            orderBy: { createdAt: 'asc' }
        });

        if (oldestPending) {
            const daysPending = Math.floor((Date.now() - oldestPending.createdAt.getTime()) / (1000 * 60 * 60 * 24));
            console.log(`\n⏱️ ANALISI TEMPORALE:`);
            console.log(`   Prodotto più vecchio in pending: ${oldestPending.title.substring(0, 50)}`);
            console.log(`   In attesa da: ${daysPending} giorni (${oldestPending.createdAt.toISOString()})`);
        }

        // 8. Controllo dati mancanti
        const missingData = await prisma.outputShopify.findMany({
            where: {
                statoCaricamento: 'pending',
                OR: [
                    { title: '' },
                    { variantPrice: { lte: 0 } }
                ]
            },
            take: 5
        });

        if (missingData.length > 0) {
            console.log('\n⚠️ PRODOTTI PENDING CON DATI MANCANTI:');
            missingData.forEach(p => {
                const issues = [];
                if (!p.title || p.title === '') issues.push('titolo mancante');
                if (!p.variantPrice || p.variantPrice <= 0) issues.push('prezzo mancante/zero');
                console.log(`   • ${p.handle} - Problemi: ${issues.join(', ')}`);
            });
        }

        console.log('\n✅ Analisi completata!\n');

    } catch (error) {
        console.error('❌ Errore durante l\'analisi:', error);
    } finally {
        await prisma.$disconnect();
    }
}

analyzeShopifyStatus();
