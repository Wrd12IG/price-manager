import prisma from '../config/database';

async function analyzeMissing() {
    const prodotti = await prisma.outputShopify.findMany({
        where: {
            metafieldsJson: { not: null },
            createdAt: { gte: new Date('2026-02-03') }
        },
        include: {
            masterFile: { include: { datiIcecat: true } }
        }
    });

    console.log('📊 Analisi prodotti senza tabella (creati 3 Feb):\n');

    let missing = 0;

    for (const p of prodotti) {
        const meta = JSON.parse(p.metafieldsJson!);
        const hasTable = 'custom.tabella_specifiche' in meta;
        const table = meta['custom.tabella_specifiche'];

        if (!hasTable || !table || table.length === 0) {
            missing++;
            const hasIcecat = !!p.masterFile.datiIcecat;
            const hasSpecs = hasIcecat && !!p.masterFile.datiIcecat?.specificheTecnicheJson;

            console.log(`❌ ${p.title.substring(0, 50)}`);
            console.log(`   Has ICECAT: ${hasIcecat ? 'SI' : 'NO'}`);
            console.log(`   Has specs JSON: ${hasSpecs ? 'SI' : 'NO'}`);

            if (hasSpecs && p.masterFile.datiIcecat?.specificheTecnicheJson) {
                try {
                    const specs = JSON.parse(p.masterFile.datiIcecat.specificheTecnicheJson);
                    console.log(`   Specs count: ${specs.length}`);
                    if (specs.length > 0) {
                        console.log(`   First spec: ${JSON.stringify(specs[0]).substring(0, 80)}`);
                    }
                } catch (e) {
                    console.log(`   ERROR parsing specs`);
                }
            }
            console.log('');
        }
    }

    console.log(`\n📊 Totale prodotti senza tabella: ${missing}/${prodotti.length}`);

    await prisma.$disconnect();
}

analyzeMissing();
