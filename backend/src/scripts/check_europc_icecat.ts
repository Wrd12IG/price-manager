import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkEuropcIcecatStatus() {
    try {
        console.log('\n🔍 ===== ANALISI STATO ICECAT - EUROPC =====\n');

        // 1. Trova l'utente europc
        const utente = await prisma.utente.findFirst({
            where: {
                OR: [
                    { email: { contains: 'europc', mode: 'insensitive' } },
                    { nome: { contains: 'europc', mode: 'insensitive' } }
                ]
            }
        });

        if (!utente) {
            console.log('❌ Utente "europc" non trovato. Controllo tutti gli utenti...');
            const utenti = await prisma.utente.findMany({ select: { id: true, email: true, nome: true } });
            console.log('\nUtenti disponibili:');
            utenti.forEach(u => console.log(`   [ID: ${u.id}] ${u.email} - ${u.nome}`));
            return;
        }

        console.log(`✅ Utente trovato: ${utente.nome} (${utente.email}) - ID: ${utente.id}\n`);
        const utenteId = utente.id;

        // 2. Statistiche MasterFile
        const totalMasterFile = await prisma.masterFile.count({ where: { utenteId } });
        console.log(`📦 Prodotti nel MasterFile: ${totalMasterFile}`);

        // 3. Statistiche ICECAT
        const withIcecat = await prisma.datiIcecat.count({
            where: { masterFile: { utenteId } }
        });
        const withImages = await prisma.datiIcecat.count({
            where: {
                masterFile: { utenteId },
                urlImmaginiJson: { not: null }
            }
        });

        console.log(`🌐 Con dati ICECAT: ${withIcecat}/${totalMasterFile} (${((withIcecat / totalMasterFile) * 100).toFixed(1)}%)`);
        console.log(`🖼️ Con immagini ICECAT: ${withImages}/${withIcecat}`);

        // 4. Statistiche OutputShopify
        const totalOutput = await prisma.outputShopify.count({ where: { utenteId } });
        const outputWithImages = await prisma.outputShopify.count({
            where: { utenteId, immaginiUrls: { not: null } }
        });
        const outputWithoutImages = await prisma.outputShopify.count({
            where: { utenteId, immaginiUrls: null }
        });

        console.log(`\n📤 Output Shopify totale: ${totalOutput}`);
        console.log(`   ✅ Con immagini: ${outputWithImages}`);
        console.log(`   ❌ Senza immagini: ${outputWithoutImages}`);

        // 5. Prodotti con ICECAT ma senza immagini in Output
        const needsUpdate = await prisma.outputShopify.count({
            where: {
                utenteId,
                immaginiUrls: null,
                masterFile: {
                    datiIcecat: {
                        urlImmaginiJson: { not: null }
                    }
                }
            }
        });

        console.log(`\n⚠️ Prodotti che necessitano aggiornamento: ${needsUpdate}`);
        console.log(`   (hanno dati ICECAT ma OutputShopify senza immagini)`);

        // 6. Esempi di prodotti senza immagini
        const examples = await prisma.outputShopify.findMany({
            where: { utenteId, immaginiUrls: null },
            take: 5,
            include: {
                masterFile: {
                    include: {
                        datiIcecat: { select: { urlImmaginiJson: true } }
                    }
                }
            }
        });

        if (examples.length > 0) {
            console.log('\n📋 Esempi prodotti senza immagini in Output:');
            examples.forEach(e => {
                const hasIcecat = e.masterFile?.datiIcecat?.urlImmaginiJson ? '✅ Sì' : '❌ No';
                console.log(`   • ${e.title.substring(0, 50)}`);
                console.log(`     ICECAT disponibile: ${hasIcecat}`);
            });
        }

        // 7. Configurazione ICECAT
        const icecatConfig = await prisma.configurazioneSistema.findFirst({
            where: { utenteId, chiave: 'icecat_username' }
        });

        console.log(`\n⚙️ Configurazione ICECAT: ${icecatConfig ? '✅ Configurato' : '❌ Non configurato'}`);

        console.log('\n✅ Analisi completata!\n');

    } catch (error) {
        console.error('❌ Errore durante l\'analisi:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkEuropcIcecatStatus();
