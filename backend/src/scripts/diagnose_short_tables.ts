import prisma from '../config/database';

async function checkMissingIcecat() {
    const prodotti = await prisma.outputShopify.findMany({
        where: { metafieldsJson: { not: null } },
        include: { masterFile: { include: { datiIcecat: true } } },
        take: 20
    });

    console.log('📊 Analisi prodotti con tabelle corte VS lunghe:\n');

    let corte = 0;
    let lunghe = 0;

    for (const o of prodotti) {
        if (!o.metafieldsJson) continue;

        const meta = JSON.parse(o.metafieldsJson);
        const table = meta['custom.tabella_specifiche'];

        if (!table) {
            console.log(`⚠️  NESSUNA TABELLA: ${o.title.substring(0, 50)}`);
            continue;
        }

        if (table.length < 100) {
            corte++;
            console.log(`\n❌ TABELLA CORTA (${table.length} char): ${o.title.substring(0, 50)}`);
            console.log(`   EAN: ${o.masterFile.eanGtin}`);
            console.log(`   Ha datiIcecat: ${o.masterFile.datiIcecat ? 'SI' : 'NO'}`);

            if (o.masterFile.datiIcecat) {
                const hasSpecs = !!o.masterFile.datiIcecat.specificheTecnicheJson;
                console.log(`   Ha specifiche JSON: ${hasSpecs ? 'SI' : 'NO'}`);

                if (hasSpecs && o.masterFile.datiIcecat.specificheTecnicheJson) {
                    try {
                        const specs = JSON.parse(o.masterFile.datiIcecat.specificheTecnicheJson);
                        console.log(`   Numero specifiche in ICECAT: ${specs.length}`);
                        if (specs.length > 0) {
                            console.log(`   Prima spec: ${JSON.stringify(specs[0])}`);
                        }
                    } catch (e) {
                        console.log(`   ❌ Errore parsing specs JSON`);
                    }
                }
            } else {
                console.log(`   ⚠️  DATI ICECAT MANCANTI!`);
            }
        } else {
            lunghe++;
            if (lunghe <= 3) {
                console.log(`\n✅ TABELLA LUNGA (${table.length} char): ${o.title.substring(0, 50)}`);
            }
        }
    }

    console.log(`\n\n📊 RIEPILOGO:`);
    console.log(`   Tabelle CORTE: ${corte}`);
    console.log(`   Tabelle LUNGHE: ${lunghe}`);

    await prisma.$disconnect();
}

checkMissingIcecat();
