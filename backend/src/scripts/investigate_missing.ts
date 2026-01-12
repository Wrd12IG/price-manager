import prisma from '../config/database';

/**
 * Script per verificare perché 3 prodotti Asus COMPUTER non sono nel MasterFile
 */
async function investigateMissingProducts() {
    const missingEans = [
        '4711387790144',
        '4711387946626',
        '4711387984567'
    ];

    console.log('🔍 Investigazione Prodotti Mancanti\n');
    console.log('EAN da verificare:');
    missingEans.forEach(ean => console.log(`   - ${ean}`));
    console.log('\n' + '='.repeat(70));

    for (const ean of missingEans) {
        console.log(`\n📦 EAN: ${ean}`);
        console.log('-'.repeat(70));

        // 1. Verifica in tutti i listini raw
        const allOccurrences = await prisma.listinoRaw.findMany({
            where: { eanGtin: ean },
            include: {
                fornitore: true
            },
            orderBy: {
                prezzoAcquisto: 'asc'
            }
        });

        console.log(`\nPresente in ${allOccurrences.length} listino/i:`);

        if (allOccurrences.length === 0) {
            console.log('   ❌ Nessun fornitore ha questo prodotto!');
            console.log('   → Questo è strano, dovrebbe essere almeno in Cometa.');
            continue;
        }

        allOccurrences.forEach((occ, i) => {
            console.log(`\n   ${i + 1}. Fornitore: ${occ.fornitore.nomeFornitore}`);
            console.log(`      Prezzo: €${occ.prezzoAcquisto}`);
            console.log(`      Quantità: ${occ.quantitaDisponibile}`);
            console.log(`      Marca: ${occ.marca || 'N/A'}`);
            console.log(`      Categoria: ${occ.categoriaFornitore || 'N/A'}`);
            console.log(`      Descrizione: ${occ.descrizioneOriginale || 'N/A'}`);
        });

        // 2. Verifica nel MasterFile
        const inMaster = await prisma.masterFile.findUnique({
            where: { eanGtin: ean },
            include: {
                fornitoreSelezionato: true
            }
        });

        console.log('\n   MasterFile:');
        if (inMaster) {
            console.log(`   ✅ PRESENTE`);
            console.log(`      Fornitore selezionato: ${inMaster.fornitoreSelezionato?.nomeFornitore}`);
            console.log(`      Prezzo migliore: €${inMaster.prezzoAcquistoMigliore}`);
            console.log(`      Marca: ${inMaster.marca || 'N/A'}`);
            console.log(`      Categoria: ${inMaster.categoriaEcommerce || 'N/A'}`);
        } else {
            console.log(`   ❌ ASSENTE`);

            // Verifica se c'è una mappatura che esclude la categoria
            if (allOccurrences.length > 0) {
                const firstOcc = allOccurrences[0];
                const mappatura = await prisma.mappaturaCategoria.findFirst({
                    where: {
                        fornitoreId: firstOcc.fornitoreId,
                        categoriaFornitore: firstOcc.categoriaFornitore || ''
                    }
                });

                if (mappatura?.escludi) {
                    console.log(`   🚨 CAUSA: Categoria "${firstOcc.categoriaFornitore}" è ESCLUSA dalla mappatura!`);
                } else {
                    console.log(`   ⚠️  Possibili cause:`);
                    console.log(`      - EAN non valido (controllo formato)`);
                    console.log(`      - Marca non riconosciuta`);
                    console.log(`      - Filtrato da regole di filtro prodotto`);
                }
            }
        }

        console.log('\n' + '-'.repeat(70));
    }

    // 3. Verifica regole di filtro attive
    console.log('\n' + '='.repeat(70));
    console.log('🎯 Regole di Filtro Prodotto Attive:');
    console.log('='.repeat(70));

    const filterRules = await prisma.productFilterRule.findMany({
        where: { attiva: true }
    });

    if (filterRules.length === 0) {
        console.log('\n⚠️  Nessuna regola di filtro attiva');
    } else {
        filterRules.forEach((rule, i) => {
            console.log(`\n${i + 1}. ${rule.nome}`);
            console.log(`   Tipo: ${rule.tipoFiltro}`);
            console.log(`   Azione: ${rule.azione}`);
            console.log(`   Brand: ${rule.brand || 'N/A'}`);
            console.log(`   Categoria: ${rule.categoria || 'N/A'}`);
        });
    }

    // 4. Verifica mappature categorie per Cometa
    console.log('\n' + '='.repeat(70));
    console.log('🗺️  Mappature Categorie Cometa:');
    console.log('='.repeat(70));

    const cometa = await prisma.fornitore.findFirst({
        where: { nomeFornitore: { contains: 'Cometa' } }
    });

    if (cometa) {
        const mappature = await prisma.mappaturaCategoria.findMany({
            where: { fornitoreId: cometa.id }
        });

        if (mappature.length === 0) {
            console.log('\n⚠️  Nessuna mappatura categoria configurata per Cometa');
        } else {
            console.log(`\nTotale mappature: ${mappature.length}\n`);
            mappature.forEach((m, i) => {
                console.log(`${i + 1}. ${m.categoriaFornitore} → ${m.categoriaEcommerce}`);
                console.log(`   Escludi: ${m.escludi ? '❌ SÌ' : '✅ NO'}`);
                console.log(`   Priorità: ${m.priorita}`);
                console.log();
            });

            const excluded = mappature.filter(m => m.escludi);
            if (excluded.length > 0) {
                console.log('🚨 Categorie ESCLUSE:');
                excluded.forEach(m => {
                    console.log(`   - ${m.categoriaFornitore}`);
                });
            }
        }
    }

    console.log('\n' + '='.repeat(70));
}

// Esegui lo script
investigateMissingProducts()
    .catch(error => {
        console.error('❌ Errore:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
