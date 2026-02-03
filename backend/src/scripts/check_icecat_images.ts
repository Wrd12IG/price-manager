import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkIcecatImages() {
    try {
        console.log('\n🖼️ ===== ANALISI IMMAGINI ICECAT - EUROPC =====\n');

        const utenteId = 3;

        // 1. Statistiche DatiIcecat
        const totalIcecat = await prisma.datiIcecat.count({
            where: { masterFile: { utenteId } }
        });

        const withImages = await prisma.datiIcecat.count({
            where: {
                masterFile: { utenteId },
                urlImmaginiJson: { not: null }
            }
        });

        const withDescription = await prisma.datiIcecat.count({
            where: {
                masterFile: { utenteId },
                descrizioneLunga: { not: null }
            }
        });

        console.log(`📊 DATI ICECAT TOTALI: ${totalIcecat}`);
        console.log(`   🖼️ Con immagini: ${withImages}`);
        console.log(`   📝 Con descrizione: ${withDescription}`);

        // 2. Esempio di record ICECAT
        const samples = await prisma.datiIcecat.findMany({
            where: { masterFile: { utenteId } },
            take: 5,
            include: {
                masterFile: {
                    select: { nomeProdotto: true, eanGtin: true, partNumber: true }
                }
            }
        });

        console.log('\n📋 ESEMPI RECORD ICECAT:');
        samples.forEach((s, i) => {
            console.log(`\n[${i + 1}] ${s.masterFile?.nomeProdotto || 'N/A'}`);
            console.log(`    EAN: ${s.eanGtin || 'N/A'}`);
            console.log(`    PartNumber: ${s.masterFile?.partNumber || 'N/A'}`);

            // Immagini
            if (s.urlImmaginiJson) {
                try {
                    const images = JSON.parse(s.urlImmaginiJson);
                    console.log(`    🖼️ Immagini: ${images.length}`);
                    if (images.length > 0) {
                        console.log(`       Prima img: ${images[0].substring(0, 60)}...`);
                    }
                } catch (e) {
                    console.log(`    🖼️ Immagini: Errore parsing JSON`);
                }
            } else {
                console.log(`    🖼️ Immagini: ❌ Nessuna`);
            }

            // Descrizione
            if (s.descrizioneBrave) {
                console.log(`    📝 Desc breve: ${s.descrizioneBrave.substring(0, 60)}...`);
            } else {
                console.log(`    📝 Desc breve: ❌ Nessuna`);
            }

            // Specifiche
            if (s.specificheTecnicheJson) {
                try {
                    const specs = JSON.parse(s.specificheTecnicheJson);
                    console.log(`    📋 Specifiche: ${specs.length} caratteristiche`);
                } catch (e) {
                    console.log(`    📋 Specifiche: Errore parsing`);
                }
            } else {
                console.log(`    📋 Specifiche: ❌ Nessuna`);
            }
        });

        // 3. Record con contenuto vuoto
        const emptyRecords = await prisma.datiIcecat.findMany({
            where: {
                masterFile: { utenteId },
                urlImmaginiJson: null,
                descrizioneLunga: null,
                specificheTecnicheJson: null
            },
            include: {
                masterFile: { select: { eanGtin: true, nomeProdotto: true, partNumber: true } }
            },
            take: 5
        });

        if (emptyRecords.length > 0) {
            console.log('\n⚠️ RECORD ICECAT VUOTI (nessun dato):');
            emptyRecords.forEach(e => {
                console.log(`   • EAN: ${e.eanGtin || 'N/A'} - ${e.masterFile?.nomeProdotto?.substring(0, 40) || 'N/A'}`);
                console.log(`     PartNumber: ${e.masterFile?.partNumber || 'N/A'}`);
            });
        }

        // 4. Verifica OutputShopify
        const outputWithImages = await prisma.outputShopify.count({
            where: { utenteId, immaginiUrls: { not: null } }
        });
        const totalOutput = await prisma.outputShopify.count({ where: { utenteId } });

        console.log(`\n📤 OUTPUT SHOPIFY:`);
        console.log(`   Totale: ${totalOutput}`);
        console.log(`   Con immagini: ${outputWithImages}`);
        console.log(`   Senza immagini: ${totalOutput - outputWithImages}`);

        console.log('\n✅ Analisi completata!\n');

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkIcecatImages();
