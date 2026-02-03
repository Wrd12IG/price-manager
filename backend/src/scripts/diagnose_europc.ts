import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkEuropcImportStatus() {
    try {
        console.log('\n🔍 ===== DIAGNOSI COMPLETA EUROPC =====\n');

        const utenteId = 3; // Euro PC

        // 1. Fornitori configurati
        const fornitori = await prisma.fornitore.findMany({
            where: { utenteId },
            select: {
                id: true,
                nomeFornitore: true,
                attivo: true,
                tipoAccesso: true,
                ftpHost: true,
                ultimaSincronizzazione: true,
                _count: { select: { listiniRaw: true } }
            }
        });

        console.log('📁 FORNITORI CONFIGURATI:');
        if (fornitori.length === 0) {
            console.log('   ❌ Nessun fornitore configurato!');
        } else {
            fornitori.forEach(f => {
                console.log(`   [${f.id}] ${f.nomeFornitore}`);
                console.log(`      Tipo: ${f.tipoAccesso}, Attivo: ${f.attivo ? '✅' : '❌'}`);
                console.log(`      Host FTP: ${f.ftpHost || 'N/A'}`);
                console.log(`      Ultima sync: ${f.ultimaSincronizzazione || 'Mai'}`);
                console.log(`      Record listino: ${f._count.listiniRaw}`);
            });
        }

        // 2. Listini Raw
        const listiniCount = await prisma.listinoRaw.count({ where: { utenteId } });
        console.log(`\n📊 LISTINI RAW: ${listiniCount} record`);

        if (listiniCount > 0) {
            const sampleListini = await prisma.listinoRaw.findMany({
                where: { utenteId },
                take: 3,
                select: { skuFornitore: true, eanGtin: true, descrizioneOriginale: true, marca: true }
            });
            console.log('   Esempi:');
            sampleListini.forEach(l => {
                console.log(`   • ${l.descrizioneOriginale?.substring(0, 50) || 'N/A'} - EAN: ${l.eanGtin || 'N/A'}`);
            });
        }

        // 3. MasterFile
        const masterFileCount = await prisma.masterFile.count({ where: { utenteId } });
        console.log(`\n📦 MASTERFILE: ${masterFileCount} prodotti`);

        // 4. Log Elaborazione recenti
        const recentLogs = await prisma.logElaborazione.findMany({
            where: { utenteId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { faseProcesso: true, stato: true, createdAt: true, dettagliJson: true, prodottiProcessati: true, prodottiErrore: true }
        });

        console.log('\n📝 LOG ELABORAZIONE RECENTI:');
        if (recentLogs.length === 0) {
            console.log('   ❌ Nessun log di elaborazione trovato!');
        } else {
            recentLogs.forEach(l => {
                console.log(`   [${l.createdAt.toISOString()}] ${l.faseProcesso} - ${l.stato}`);
                console.log(`      Processati: ${l.prodottiProcessati}, Errori: ${l.prodottiErrore}`);
            });
        }

        // 5. Dati ICECAT
        const icecatCount = await prisma.datiIcecat.count({
            where: { masterFile: { utenteId } }
        });
        console.log(`\n🌐 DATI ICECAT: ${icecatCount} record`);

        // 6. Output Shopify
        const outputCount = await prisma.outputShopify.count({ where: { utenteId } });
        console.log(`📤 OUTPUT SHOPIFY: ${outputCount} record`);

        // 7. Configurazioni sistema
        const configs = await prisma.configurazioneSistema.findMany({
            where: { utenteId },
            select: { chiave: true, valore: true }
        });

        console.log('\n⚙️ CONFIGURAZIONI:');
        configs.forEach(c => {
            const value = c.chiave.includes('password') || c.chiave.includes('token')
                ? '***HIDDEN***'
                : c.valore?.substring(0, 50) || 'vuoto';
            console.log(`   ${c.chiave}: ${value}`);
        });

        // 8. Suggerimenti
        console.log('\n💡 DIAGNOSI:');
        if (fornitori.length === 0) {
            console.log('   ⚠️ Configura almeno un fornitore per iniziare l\'importazione');
        } else if (listiniCount === 0) {
            console.log('   ⚠️ Esegui la sincronizzazione dei listini dai fornitori');
        } else if (masterFileCount === 0) {
            console.log('   ⚠️ Esegui l\'elaborazione dei listini per popolare il MasterFile');
        } else if (icecatCount === 0) {
            console.log('   ⚠️ Avvia l\'arricchimento ICECAT per scaricare le schede prodotto');
        } else if (outputCount === 0) {
            console.log('   ⚠️ Genera l\'export Shopify per preparare i prodotti');
        }

        console.log('\n✅ Diagnosi completata!\n');

    } catch (error) {
        console.error('❌ Errore durante la diagnosi:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkEuropcImportStatus();
