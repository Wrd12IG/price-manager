import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRawData() {
    try {
        console.log('--- Checking ListinoRaw (imported supplier data) ---');
        const rawCount = await prisma.listinoRaw.count();
        console.log(`Total products in ListinoRaw: ${rawCount}`);

        if (rawCount > 0) {
            // Check for Asus products
            const asusProducts = await prisma.listinoRaw.findMany({
                where: {
                    OR: [
                        { marca: { contains: 'Asus' } },
                        { descrizioneOriginale: { contains: 'Asus' } }
                    ]
                },
                take: 10,
                include: {
                    fornitore: true
                }
            });

            console.log(`\nAsus products in ListinoRaw: ${asusProducts.length}`);

            for (const p of asusProducts.slice(0, 5)) {
                console.log(`\n  SKU: ${p.skuFornitore}`);
                console.log(`  EAN: ${p.eanGtin}`);
                console.log(`  Marca: "${p.marca}"`);
                console.log(`  Categoria: "${p.categoriaFornitore}"`);
                console.log(`  Descrizione: ${p.descrizioneOriginale?.substring(0, 80)}...`);
                console.log(`  Fornitore: ${p.fornitore.nomeFornitore}`);
                console.log(`  Prezzo: ${p.prezzoAcquisto}`);
            }

            // Check all brands
            console.log('\n--- All brands in ListinoRaw (sample) ---');
            const allRaw = await prisma.listinoRaw.findMany({
                select: { marca: true },
                take: 1000
            });

            const brandMap = new Map<string, number>();
            for (const p of allRaw) {
                if (p.marca) {
                    brandMap.set(p.marca, (brandMap.get(p.marca) || 0) + 1);
                }
            }

            const sortedBrands = Array.from(brandMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 30);

            sortedBrands.forEach(([brand, count]) => {
                console.log(`  "${brand}": ${count} products`);
            });
        }

        console.log('\n--- Checking Fornitori (suppliers) ---');
        const suppliers = await prisma.fornitore.findMany({
            select: {
                id: true,
                nomeFornitore: true,
                attivo: true,
                ultimaSincronizzazione: true,
                _count: {
                    select: {
                        listiniRaw: true,
                        masterFileRecords: true
                    }
                }
            }
        });

        console.log(`Total suppliers: ${suppliers.length}`);
        for (const s of suppliers) {
            console.log(`\n  ${s.nomeFornitore} (ID: ${s.id})`);
            console.log(`    Attivo: ${s.attivo}`);
            console.log(`    Ultima sincronizzazione: ${s.ultimaSincronizzazione}`);
            console.log(`    Prodotti in ListinoRaw: ${s._count.listiniRaw}`);
            console.log(`    Prodotti in MasterFile: ${s._count.masterFileRecords}`);
        }

        console.log('\n--- Checking recent import logs ---');
        const logs = await prisma.logElaborazione.findMany({
            orderBy: { dataEsecuzione: 'desc' },
            take: 5
        });

        for (const log of logs) {
            console.log(`\n  ${log.dataEsecuzione.toISOString()}`);
            console.log(`  Fase: ${log.faseProcesso}`);
            console.log(`  Stato: ${log.stato}`);
            console.log(`  Prodotti processati: ${log.prodottiProcessati}`);
            console.log(`  Errori: ${log.prodottiErrore}`);
            if (log.dettagliJson) {
                console.log(`  Dettagli: ${log.dettagliJson.substring(0, 200)}`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkRawData();
