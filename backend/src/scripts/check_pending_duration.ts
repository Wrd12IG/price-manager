import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPendingDuration() {
    try {
        console.log('\n⏱️  ===== DURATA PRODOTTI IN PENDING =====\n');

        // Tempo attuale
        const now = new Date();
        console.log(`🕐 Ora attuale: ${now.toISOString()}\n`);

        // Statistiche generali
        const stats = await prisma.outputShopify.groupBy({
            by: ['statoCaricamento'],
            _count: true
        });

        console.log('📊 STATO GENERALE:');
        stats.forEach(s => {
            console.log(`   ${s.statoCaricamento}: ${s._count} prodotti`);
        });

        // Prodotto più vecchio in pending
        const oldestPending = await prisma.outputShopify.findFirst({
            where: { statoCaricamento: 'pending' },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                handle: true,
                title: true,
                createdAt: true,
                updatedAt: true
            }
        });

        // Prodotto più recente in pending
        const newestPending = await prisma.outputShopify.findFirst({
            where: { statoCaricamento: 'pending' },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                handle: true,
                title: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (oldestPending && newestPending) {
            const oldestAgeMs = now.getTime() - oldestPending.createdAt.getTime();
            const newestAgeMs = now.getTime() - newestPending.createdAt.getTime();

            const oldestHours = Math.floor(oldestAgeMs / (1000 * 60 * 60));
            const oldestMinutes = Math.floor((oldestAgeMs % (1000 * 60 * 60)) / (1000 * 60));

            const newestHours = Math.floor(newestAgeMs / (1000 * 60 * 60));
            const newestMinutes = Math.floor((newestAgeMs % (1000 * 60 * 60)) / (1000 * 60));

            console.log('\n🔴 PRODOTTO PIÙ VECCHIO IN PENDING:');
            console.log(`   Titolo: ${oldestPending.title.substring(0, 60)}`);
            console.log(`   Creato: ${oldestPending.createdAt.toISOString()}`);
            console.log(`   ⏱️  In attesa da: ${oldestHours}h ${oldestMinutes}m`);

            console.log('\n🟢 PRODOTTO PIÙ RECENTE IN PENDING:');
            console.log(`   Titolo: ${newestPending.title.substring(0, 60)}`);
            console.log(`   Creato: ${newestPending.createdAt.toISOString()}`);
            console.log(`   ⏱️  In attesa da: ${newestHours}h ${newestMinutes}m`);
        }

        // Distribuzione per intervalli temporali
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

        const lastHourCount = await prisma.outputShopify.count({
            where: {
                statoCaricamento: 'pending',
                createdAt: { gte: oneHourAgo }
            }
        });

        const last2HoursCount = await prisma.outputShopify.count({
            where: {
                statoCaricamento: 'pending',
                createdAt: { gte: twoHoursAgo, lt: oneHourAgo }
            }
        });

        const last3HoursCount = await prisma.outputShopify.count({
            where: {
                statoCaricamento: 'pending',
                createdAt: { gte: threeHoursAgo, lt: twoHoursAgo }
            }
        });

        const olderCount = await prisma.outputShopify.count({
            where: {
                statoCaricamento: 'pending',
                createdAt: { lt: threeHoursAgo }
            }
        });

        console.log('\n📅 DISTRIBUZIONE TEMPORALE PRODOTTI IN PENDING:');
        console.log(`   📌 Ultima ora: ${lastHourCount} prodotti`);
        console.log(`   📌 1-2 ore fa: ${last2HoursCount} prodotti`);
        console.log(`   📌 2-3 ore fa: ${last3HoursCount} prodotti`);
        console.log(`   📌 Più di 3 ore fa: ${olderCount} prodotti`);

        // Velocità di caricamento
        const lastUploadedProducts = await prisma.outputShopify.findMany({
            where: { statoCaricamento: 'uploaded' },
            orderBy: { updatedAt: 'desc' },
            take: 10,
            select: { updatedAt: true }
        });

        if (lastUploadedProducts.length >= 2) {
            const latestUpdate = lastUploadedProducts[0].updatedAt;
            const minutesSinceLastUpdate = Math.floor((now.getTime() - latestUpdate.getTime()) / (1000 * 60));

            // Calcola velocità degli ultimi 10
            const firstOfLast10 = lastUploadedProducts[lastUploadedProducts.length - 1].updatedAt;
            const timeSpan = latestUpdate.getTime() - firstOfLast10.getTime();
            const productsPerMinute = timeSpan > 0 ? (10 / (timeSpan / (1000 * 60))).toFixed(2) : 0;

            console.log('\n⚡ VELOCITÀ DI CARICAMENTO:');
            console.log(`   Ultimo caricamento: ${minutesSinceLastUpdate} minuti fa`);
            console.log(`   Velocità media: ~${productsPerMinute} prodotti/minuto`);

            if (parseFloat(productsPerMinute as string) > 0) {
                const remainingPending = await prisma.outputShopify.count({
                    where: { statoCaricamento: 'pending' }
                });
                const estimatedMinutes = Math.ceil(remainingPending / parseFloat(productsPerMinute as string));
                const estimatedHours = Math.floor(estimatedMinutes / 60);
                const estimatedMins = estimatedMinutes % 60;

                console.log(`   📊 Tempo stimato per completamento: ~${estimatedHours}h ${estimatedMins}m`);
            }
        }

        // Ultimo sync log
        const lastSyncLog = await prisma.logElaborazione.findFirst({
            where: { faseProcesso: 'SYNC_SHOPIFY' },
            orderBy: { createdAt: 'desc' }
        });

        if (lastSyncLog) {
            const syncAgeMs = now.getTime() - lastSyncLog.createdAt.getTime();
            const syncMinutes = Math.floor(syncAgeMs / (1000 * 60));

            console.log('\n🔄 ULTIMA SINCRONIZZAZIONE:');
            console.log(`   Stato: ${lastSyncLog.stato}`);
            console.log(`   Avviata: ${lastSyncLog.createdAt.toISOString()}`);
            console.log(`   ${syncMinutes} minuti fa`);

            if (lastSyncLog.dettagliJson) {
                try {
                    const details = JSON.parse(lastSyncLog.dettagliJson);
                    console.log(`   Dettagli: ${JSON.stringify(details)}`);
                } catch (e) {
                    // ignore
                }
            }
        }

        console.log('\n✅ Analisi completata!\n');

    } catch (error) {
        console.error('❌ Errore durante l\'analisi:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkPendingDuration();
