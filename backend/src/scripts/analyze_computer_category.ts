import prisma from '../config/database';

/**
 * Script per analizzare i prodotti nella categoria "COMPUTER" di Cometa
 */
async function analyzeComputerCategory() {
    console.log('🔍 Analisi Categoria COMPUTER - Listino Cometa\n');

    const cometa = await prisma.fornitore.findFirst({
        where: { nomeFornitore: { contains: 'Cometa' } }
    });

    if (!cometa) {
        console.error('❌ Fornitore Cometa non trovato!');
        return;
    }

    // 1. Prodotti ASUS nella categoria COMPUTER
    console.log('📦 Prodotti ASUS nella categoria COMPUTER:');
    console.log('='.repeat(70));

    const asusComputers = await prisma.listinoRaw.findMany({
        where: {
            fornitoreId: cometa.id,
            marca: { contains: 'ASUS' },
            categoriaFornitore: 'COMPUTER',
            eanGtin: { not: null }
        }
    });

    console.log(`Totale: ${asusComputers.length} prodotti\n`);

    asusComputers.forEach((p, i) => {
        console.log(`${i + 1}. EAN: ${p.eanGtin}`);
        console.log(`   SKU: ${p.skuFornitore}`);
        console.log(`   Marca: ${p.marca}`);
        console.log(`   Descrizione: ${p.descrizioneOriginale}`);
        console.log(`   Prezzo: €${p.prezzoAcquisto}`);
        console.log(`   Quantità: ${p.quantitaDisponibile}`);
        console.log();
    });

    // 2. Verifica se sono nel MasterFile
    console.log('='.repeat(70));
    console.log('🔍 Verifica presenza nel MasterFile:');
    console.log('='.repeat(70));

    const eans = asusComputers.map(p => p.eanGtin).filter((e): e is string => e !== null);

    const inMasterFile = await prisma.masterFile.findMany({
        where: {
            eanGtin: { in: eans }
        },
        include: {
            fornitoreSelezionato: true,
            datiIcecat: {
                select: {
                    descrizioneBrave: true,
                    specificheTecnicheJson: true
                }
            }
        }
    });

    console.log(`\nProdotti nel MasterFile: ${inMasterFile.length}/${asusComputers.length}\n`);

    if (inMasterFile.length > 0) {
        console.log('✅ Prodotti trovati nel MasterFile:');
        inMasterFile.forEach((p, i) => {
            console.log(`\n${i + 1}. EAN: ${p.eanGtin}`);
            console.log(`   Nome: ${p.nomeProdotto}`);
            console.log(`   Marca: ${p.marca}`);
            console.log(`   Categoria: ${p.categoriaEcommerce}`);
            console.log(`   Fornitore: ${p.fornitoreSelezionato?.nomeFornitore}`);

            if (p.datiIcecat?.descrizioneBrave) {
                console.log(`   Icecat: ${p.datiIcecat.descrizioneBrave.substring(0, 80)}...`);
            }
        });
    }

    const missingEans = eans.filter(ean =>
        !inMasterFile.some(m => m.eanGtin === ean)
    );

    if (missingEans.length > 0) {
        console.log(`\n❌ Prodotti NON nel MasterFile: ${missingEans.length}`);
        console.log('\nDettagli prodotti mancanti:');

        const missing = asusComputers.filter(p => missingEans.includes(p.eanGtin!));
        missing.forEach((p, i) => {
            console.log(`\n${i + 1}. EAN: ${p.eanGtin}`);
            console.log(`   Descrizione: ${p.descrizioneOriginale}`);
            console.log(`   Categoria: ${p.categoriaFornitore}`);
            console.log(`   Prezzo: €${p.prezzoAcquisto}`);
        });

        console.log('\n⚠️  POSSIBILE CAUSA: Questi prodotti potrebbero essere stati:');
        console.log('   1. Filtrati durante il consolidamento');
        console.log('   2. Esclusi da una mappatura di categoria');
        console.log('   3. Hanno un prezzo più alto rispetto ad altri fornitori');
    }

    // 3. Verifica mappature categorie per "COMPUTER"
    console.log('\n' + '='.repeat(70));
    console.log('🗺️  Mappatura Categoria "COMPUTER":');
    console.log('='.repeat(70));

    const mappatura = await prisma.mappaturaCategoria.findFirst({
        where: {
            fornitoreId: cometa.id,
            categoriaFornitore: 'COMPUTER'
        }
    });

    if (mappatura) {
        console.log('\n✅ Mappatura trovata:');
        console.log(`   Categoria Fornitore: ${mappatura.categoriaFornitore}`);
        console.log(`   Categoria E-commerce: ${mappatura.categoriaEcommerce}`);
        console.log(`   Escludi: ${mappatura.escludi ? '❌ SÌ' : '✅ NO'}`);
        console.log(`   Priorità: ${mappatura.priorita}`);

        if (mappatura.escludi) {
            console.log('\n🚨 PROBLEMA TROVATO!');
            console.log('   La categoria "COMPUTER" è marcata come ESCLUSA!');
            console.log('   Questo spiega perché i prodotti non appaiono nel MasterFile.');
        }
    } else {
        console.log('\n⚠️  Nessuna mappatura trovata per la categoria "COMPUTER"');
        console.log('   I prodotti useranno la categoria originale del fornitore.');
    }

    console.log('\n' + '='.repeat(70));
}

// Esegui lo script
analyzeComputerCategory()
    .catch(error => {
        console.error('❌ Errore:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
