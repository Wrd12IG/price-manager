import prisma from '../config/database';

async function quickCheck() {
    console.log('🔍 Verifica Rapida Categoria COMPUTER\n');

    const cometa = await prisma.fornitore.findFirst({
        where: { nomeFornitore: { contains: 'Cometa' } }
    });

    if (!cometa) {
        console.error('❌ Cometa non trovato');
        return;
    }

    // Prodotti ASUS categoria COMPUTER
    const asusComputers = await prisma.listinoRaw.findMany({
        where: {
            fornitoreId: cometa.id,
            marca: 'ASUS',
            categoriaFornitore: 'COMPUTER'
        }
    });

    console.log(`Prodotti ASUS categoria COMPUTER: ${asusComputers.length}\n`);

    // Verifica mappatura
    const mappatura = await prisma.mappaturaCategoria.findFirst({
        where: {
            fornitoreId: cometa.id,
            categoriaFornitore: 'COMPUTER'
        }
    });

    console.log('Mappatura categoria COMPUTER:');
    if (mappatura) {
        console.log(`  → ${mappatura.categoriaEcommerce}`);
        console.log(`  Escludi: ${mappatura.escludi ? '❌ SÌ' : '✅ NO'}`);

        if (mappatura.escludi) {
            console.log('\n🚨 PROBLEMA: La categoria COMPUTER è ESCLUSA!');
            console.log('   Questo spiega perché i notebook Asus non appaiono.\n');
        }
    } else {
        console.log('  ⚠️  Nessuna mappatura (usa categoria originale)\n');
    }

    // Mostra tutti i prodotti
    console.log('Prodotti ASUS COMPUTER:');
    asusComputers.forEach((p, i) => {
        console.log(`${i + 1}. ${p.eanGtin} - ${p.descrizioneOriginale} - €${p.prezzoAcquisto}`);
    });

    await prisma.$disconnect();
}

quickCheck().catch(console.error);
