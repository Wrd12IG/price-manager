import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function investigateSyncIssues() {
    try {
        console.log('\n🔍 ===== INVESTIGAZIONE PROBLEMI SINCRONIZZAZIONE =====\n');

        // 1. Analizza i log di SYNC_SHOPIFY con warning/error
        const problematicLogs = await prisma.logElaborazione.findMany({
            where: {
                faseProcesso: 'SYNC_SHOPIFY',
                OR: [
                    { stato: 'warning' },
                    { stato: 'error' },
                    { prodottiErrore: { gt: 0 } }
                ]
            },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        console.log('⚠️ LOG SINCRONIZZAZIONE CON PROBLEMI:');
        for (const log of problematicLogs) {
            console.log(`\n   [${log.createdAt.toISOString()}] Fase: ${log.faseProcesso} - Stato: ${log.stato}`);
            console.log(`   Prodotti: ${log.prodottiProcessati}, Errori: ${log.prodottiErrore}`);

            if (log.dettagliJson) {
                try {
                    const details = JSON.parse(log.dettagliJson);
                    console.log(`   Dettagli completi:`, JSON.stringify(details, null, 2));
                } catch (e) {
                    console.log(`   Dettagli grezzi: ${log.dettagliJson}`);
                }
            }
        }

        // 2. Trova la sincronizzazione incompleta più recente
        const incompleteSyncs = await prisma.logElaborazione.findMany({
            where: {
                faseProcesso: 'SYNC_SHOPIFY',
                stato: 'running'
            },
            orderBy: { createdAt: 'desc' },
            take: 3
        });

        if (incompleteSyncs.length > 0) {
            console.log('\n🔄 SINCRONIZZAZIONI RIMASTE IN "RUNNING" (incomplete):');
            incompleteSyncs.forEach(sync => {
                console.log(`   [${sync.createdAt.toISOString()}] - ${sync.prodottiProcessati} prodotti processati`);
                const minutesAgo = Math.floor((Date.now() - sync.createdAt.getTime()) / (1000 * 60));
                console.log(`   ⏱️ Avviata ${minutesAgo} minuti fa`);
            });
        }

        // 3. Verifica se ci sono stati record aggiornati di recente
        const recentUpdates = await prisma.outputShopify.findMany({
            where: {
                updatedAt: {
                    gte: new Date(Date.now() - 3 * 60 * 60 * 1000) // Ultime 3 ore
                }
            },
            orderBy: { updatedAt: 'desc' },
            take: 10,
            select: {
                id: true,
                title: true,
                statoCaricamento: true,
                updatedAt: true,
                errorMessage: true
            }
        });

        console.log('\n📊 PRODOTTI AGGIORNATI NELLE ULTIME 3 ORE:');
        if (recentUpdates.length === 0) {
            console.log('   ❌ Nessun aggiornamento recente - La sincronizzazione potrebbe essersi bloccata');
        } else {
            recentUpdates.forEach(p => {
                const minutesAgo = Math.floor((Date.now() - p.updatedAt.getTime()) / (1000 * 60));
                console.log(`   • [${minutesAgo}m fa] ${p.title.substring(0, 50)} - ${p.statoCaricamento}`);
                if (p.errorMessage) {
                    console.log(`     Errore: ${p.errorMessage}`);
                }
            });
        }

        // 4. Prodotti con prezzi problematici
        const priceIssues = await prisma.outputShopify.findMany({
            where: {
                statoCaricamento: 'pending',
                variantPrice: { lte: 0 }
            },
            take: 10,
            select: {
                handle: true,
                title: true,
                variantPrice: true
            }
        });

        if (priceIssues.length > 0) {
            console.log('\n💰 PRODOTTI IN PENDING CON PROBLEMI DI PREZZO:');
            priceIssues.forEach(p => {
                console.log(`   • ${p.title.substring(0, 50)}`);
                console.log(`     Prezzo Output: €${p.variantPrice}`);
            });
        }

        // 5. Statistiche per marca/vendor
        const vendorStats = await prisma.outputShopify.groupBy({
            by: ['vendor', 'statoCaricamento'],
            _count: true,
            where: {
                statoCaricamento: { in: ['pending', 'uploaded'] }
            }
        });

        console.log('\n🏭 STATISTICHE PER VENDOR:');
        const vendors = Array.from(new Set(vendorStats.map(v => v.vendor)));
        for (const vendor of vendors) {
            const uploaded = vendorStats.find(v => v.vendor === vendor && v.statoCaricamento === 'uploaded')?._count || 0;
            const pending = vendorStats.find(v => v.vendor === vendor && v.statoCaricamento === 'pending')?._count || 0;
            const total = uploaded + pending;
            const percentage = total > 0 ? ((uploaded / total) * 100).toFixed(1) : 0;
            console.log(`   ${vendor}: ${uploaded}/${total} caricati (${percentage}%)`);
        }

        // 6. Verifica configurazione Shopify
        const shopifyConfigs = await prisma.configurazioneSistema.findMany({
            where: {
                chiave: { in: ['shopify_shop_url', 'shopify_access_token'] }
            }
        });

        console.log('\n🔐 VERIFICA CONFIGURAZIONE:');
        const hasUrl = shopifyConfigs.some(c => c.chiave === 'shopify_shop_url' && c.valore);
        const hasToken = shopifyConfigs.some(c => c.chiave === 'shopify_access_token' && c.valore);

        console.log(`   Shop URL configurato: ${hasUrl ? '✅ Sì' : '❌ No'}`);
        console.log(`   Access Token configurato: ${hasToken ? '✅ Sì' : '❌ No'}`);

        if (hasUrl && hasToken) {
            console.log('   ✅ Configurazione completa');
        } else {
            console.log('   ⚠️ Configurazione incompleta - verificare credenziali Shopify');
        }

        console.log('\n✅ Investigazione completata!\n');

    } catch (error) {
        console.error('❌ Errore durante l\'investigazione:', error);
    } finally {
        await prisma.$disconnect();
    }
}

investigateSyncIssues();
