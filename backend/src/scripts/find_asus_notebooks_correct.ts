import prisma from '../config/database';
import { ProductFilterService } from '../services/ProductFilterService';

/**
 * Script corretto per cercare i notebook Asus usando il campo mappato correttamente
 * DescriCatOmo → categoriaFornitore
 */
async function findAsusNotebooksCorrect() {
    console.log('🔍 Ricerca CORRETTA Notebook Asus nel Listino Cometa\n');

    // 1. Trova il fornitore Cometa
    const cometa = await prisma.fornitore.findFirst({
        where: { nomeFornitore: { contains: 'Cometa' } }
    });

    if (!cometa) {
        console.error('❌ Fornitore Cometa non trovato!');
        return;
    }

    console.log(`✅ Fornitore Cometa: ID ${cometa.id}\n`);

    // 2. Cerca prodotti ASUS con categoria "NOTEBOOK" (dal campo DescriCatOmo mappato)
    console.log('📦 STEP 1: Ricerca nel Listino RAW');
    console.log('='.repeat(70));
    console.log('Criteri di ricerca:');
    console.log('   - Fornitore: Cometa');
    console.log('   - Marca: ASUS');
    console.log('   - Categoria (DescriCatOmo): NOTEBOOK');
    console.log('   - EAN: non nullo\n');

    const asusNotebooks = await prisma.listinoRaw.findMany({
        where: {
            fornitoreId: cometa.id,
            marca: 'ASUS',
            categoriaFornitore: 'NOTEBOOK',
            eanGtin: { not: null }
        },
        orderBy: {
            prezzoAcquisto: 'asc'
        }
    });

    console.log(`✅ Trovati ${asusNotebooks.length} notebook Asus nel listino RAW\n`);

    if (asusNotebooks.length === 0) {
        console.log('❌ PROBLEMA: Nessun notebook Asus trovato!');
        console.log('\nVerifica possibili cause:');

        // Verifica se ci sono prodotti ASUS con categoria simile
        const asusAll = await prisma.listinoRaw.findMany({
            where: {
                fornitoreId: cometa.id,
                marca: 'ASUS',
                eanGtin: { not: null }
            },
            select: {
                categoriaFornitore: true
            }
        });

        const categories = new Set(asusAll.map(p => p.categoriaFornitore).filter(c => c));
        console.log('\nCategorie disponibili per prodotti ASUS in Cometa:');
        Array.from(categories).sort().forEach(cat => {
            const count = asusAll.filter(p => p.categoriaFornitore === cat).length;
            console.log(`   - "${cat}": ${count} prodotti`);
        });

        return;
    }

    // Mostra i primi 10 notebook trovati
    console.log('Dettagli notebook trovati (primi 10):');
    console.log('-'.repeat(70));
    asusNotebooks.slice(0, 10).forEach((p, i) => {
        console.log(`\n${i + 1}. EAN: ${p.eanGtin}`);
        console.log(`   SKU: ${p.skuFornitore}`);
        console.log(`   Descrizione: ${p.descrizioneOriginale}`);
        console.log(`   Prezzo: €${p.prezzoAcquisto}`);
        console.log(`   Quantità: ${p.quantitaDisponibile}`);
    });

    // 3. Verifica nel MasterFile
    console.log('\n' + '='.repeat(70));
    console.log('📊 STEP 2: Verifica presenza nel MasterFile');
    console.log('='.repeat(70));

    const notebookEans = asusNotebooks.map(p => p.eanGtin).filter((e): e is string => e !== null);

    const inMasterFile = await prisma.masterFile.findMany({
        where: {
            eanGtin: { in: notebookEans }
        },
        include: {
            fornitoreSelezionato: true,
            datiIcecat: {
                select: {
                    descrizioneBrave: true
                }
            }
        }
    });

    console.log(`\n✅ Nel MasterFile: ${inMasterFile.length}/${asusNotebooks.length} notebook\n`);

    if (inMasterFile.length > 0) {
        console.log('Esempi nel MasterFile (primi 5):');
        inMasterFile.slice(0, 5).forEach((p, i) => {
            console.log(`\n${i + 1}. EAN: ${p.eanGtin}`);
            console.log(`   Nome: ${p.nomeProdotto?.substring(0, 60)}...`);
            console.log(`   Marca: ${p.marca}`);
            console.log(`   Categoria: ${p.categoriaEcommerce}`);
            console.log(`   Fornitore: ${p.fornitoreSelezionato?.nomeFornitore}`);
            console.log(`   Prezzo: €${p.prezzoAcquistoMigliore}`);
        });
    }

    // 4. Identifica i mancanti
    const missingEans = notebookEans.filter(ean =>
        !inMasterFile.some(m => m.eanGtin === ean)
    );

    if (missingEans.length > 0) {
        console.log(`\n❌ NON nel MasterFile: ${missingEans.length}/${asusNotebooks.length} notebook\n`);

        const missingProducts = asusNotebooks.filter(p => missingEans.includes(p.eanGtin!));

        console.log('Dettagli prodotti mancanti (primi 10):');
        missingProducts.slice(0, 10).forEach((p, i) => {
            console.log(`\n${i + 1}. EAN: ${p.eanGtin}`);
            console.log(`   Descrizione: ${p.descrizioneOriginale}`);
            console.log(`   Prezzo: €${p.prezzoAcquisto}`);
            console.log(`   Quantità: ${p.quantitaDisponibile}`);
        });

        // 5. Investigazione cause
        console.log('\n' + '='.repeat(70));
        console.log('🔍 STEP 3: Investigazione Cause Esclusione');
        console.log('='.repeat(70));

        // Verifica mappatura categoria
        const mappatura = await prisma.mappaturaCategoria.findFirst({
            where: {
                fornitoreId: cometa.id,
                categoriaFornitore: 'NOTEBOOK'
            }
        });

        console.log('\n1. Mappatura Categoria "NOTEBOOK":');
        if (mappatura) {
            console.log(`   ✅ Mappatura trovata:`);
            console.log(`      Categoria E-commerce: ${mappatura.categoriaEcommerce}`);
            console.log(`      Escludi: ${mappatura.escludi ? '❌ SÌ - QUESTA È LA CAUSA!' : '✅ NO'}`);
            console.log(`      Priorità: ${mappatura.priorita}`);

            if (mappatura.escludi) {
                console.log('\n   🚨 PROBLEMA TROVATO!');
                console.log('   La categoria "NOTEBOOK" è marcata come ESCLUSA nella mappatura!');
                console.log('   Soluzione: Rimuovere il flag "escludi" dalla mappatura.');
            }
        } else {
            console.log('   ⚠️  Nessuna mappatura specifica per "NOTEBOOK"');
        }

        // Verifica regole di filtro
        console.log('\n2. Regole di Filtro Prodotto:');
        const filterService = new ProductFilterService();
        const activeRules = await filterService.getActiveRules();

        if (activeRules.length === 0) {
            console.log('   ⚠️  Nessuna regola di filtro attiva');
        } else {
            console.log(`   Regole attive: ${activeRules.length}`);
            activeRules.forEach(rule => {
                console.log(`      - ${rule.nome}: ${rule.tipoFiltro} (${rule.azione})`);
                if (rule.brand) console.log(`        Brand: ${rule.brand}`);
                if (rule.categoria) console.log(`        Categoria: ${rule.categoria}`);
            });

            // Test filtro su un prodotto mancante
            if (missingProducts.length > 0) {
                const testProduct = missingProducts[0];
                console.log(`\n   Test filtro su: ${testProduct.eanGtin}`);

                const filterResult = await filterService.shouldIncludeProduct(
                    testProduct.marca,
                    testProduct.categoriaFornitore
                );

                console.log(`      Risultato: ${filterResult.shouldInclude ? '✅ INCLUSO' : '❌ ESCLUSO'}`);
                console.log(`      Motivo: ${filterResult.reason}`);
            }
        }

        // Verifica se esistono in altri fornitori con prezzo migliore
        console.log('\n3. Verifica Prezzi Altri Fornitori:');
        const sampleEan = missingEans[0];
        const allOccurrences = await prisma.listinoRaw.findMany({
            where: { eanGtin: sampleEan },
            include: { fornitore: true },
            orderBy: { prezzoAcquisto: 'asc' }
        });

        if (allOccurrences.length > 1) {
            console.log(`   Esempio EAN ${sampleEan}:`);
            allOccurrences.forEach(occ => {
                console.log(`      - ${occ.fornitore.nomeFornitore}: €${occ.prezzoAcquisto}`);
            });

            const cometaPrice = allOccurrences.find(o => o.fornitoreId === cometa.id);
            const bestPrice = allOccurrences[0];

            if (cometaPrice && bestPrice.fornitoreId !== cometa.id) {
                console.log(`\n   ⚠️  Cometa non ha il prezzo migliore per questo prodotto.`);
                console.log(`      Questo potrebbe spiegare l'assenza nel MasterFile.`);
            }
        } else {
            console.log(`   Solo Cometa ha questo prodotto.`);
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📋 RIEPILOGO');
    console.log('='.repeat(70));
    console.log(`Notebook Asus nel listino Cometa: ${asusNotebooks.length}`);
    console.log(`Presenti nel MasterFile: ${inMasterFile.length}`);
    console.log(`Mancanti dal MasterFile: ${missingEans.length}`);

    if (missingEans.length > 0) {
        const percentage = ((missingEans.length / asusNotebooks.length) * 100).toFixed(1);
        console.log(`\n⚠️  ${percentage}% dei notebook Asus non sono nel MasterFile!`);
    }

    console.log('\n' + '='.repeat(70));
}

// Esegui lo script
findAsusNotebooksCorrect()
    .catch(error => {
        console.error('❌ Errore:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
