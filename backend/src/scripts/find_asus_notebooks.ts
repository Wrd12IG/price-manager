import prisma from '../config/database';

/**
 * Script per cercare specificamente i notebook Asus nel listino Cometa
 */
async function findAsusNotebooks() {
    console.log('🔍 Ricerca Notebook Asus nel Listino Cometa\n');

    // 1. Trova il fornitore Cometa
    const cometa = await prisma.fornitore.findFirst({
        where: { nomeFornitore: { contains: 'Cometa' } }
    });

    if (!cometa) {
        console.error('❌ Fornitore Cometa non trovato!');
        return;
    }

    console.log(`✅ Fornitore Cometa: ID ${cometa.id}\n`);

    // 2. Cerca prodotti raw con ASUS e categoria contenente "notebook" o "portatile"
    const notebookKeywords = ['NOTEBOOK', 'PORTATILE', 'LAPTOP', 'PORTABLE'];

    console.log('📦 Ricerca nel Listino RAW:');
    console.log('='.repeat(70));

    const rawProducts = await prisma.listinoRaw.findMany({
        where: {
            fornitoreId: cometa.id,
            marca: { contains: 'ASUS' },
            eanGtin: { not: null }
        }
    });

    console.log(`Totale prodotti Asus con EAN: ${rawProducts.length}\n`);

    // Filtra per categoria notebook
    const notebooks = rawProducts.filter(p => {
        const cat = p.categoriaFornitore?.toUpperCase() || '';
        const desc = p.descrizioneOriginale?.toUpperCase() || '';
        return notebookKeywords.some(kw => cat.includes(kw) || desc.includes(kw));
    });

    console.log(`Prodotti che sembrano notebook: ${notebooks.length}\n`);

    if (notebooks.length > 0) {
        console.log('✅ Notebook Asus trovati nel RAW (primi 10):');
        notebooks.slice(0, 10).forEach((p, i) => {
            console.log(`\n${i + 1}. EAN: ${p.eanGtin}`);
            console.log(`   Marca: ${p.marca}`);
            console.log(`   Categoria: ${p.categoriaFornitore}`);
            console.log(`   Descrizione: ${p.descrizioneOriginale?.substring(0, 70)}...`);
            console.log(`   Prezzo: €${p.prezzoAcquisto}`);
            console.log(`   Quantità: ${p.quantitaDisponibile}`);
        });
    }

    // 3. Verifica quanti di questi sono nel MasterFile
    console.log('\n' + '='.repeat(70));
    console.log('🔍 Verifica nel MasterFile:');
    console.log('='.repeat(70));

    const notebookEans = notebooks.map(p => p.eanGtin).filter((e): e is string => e !== null);

    const inMasterFile = await prisma.masterFile.findMany({
        where: {
            eanGtin: { in: notebookEans }
        },
        include: {
            fornitoreSelezionato: true
        }
    });

    console.log(`\nNotebook Asus nel MasterFile: ${inMasterFile.length}/${notebooks.length}\n`);

    if (inMasterFile.length > 0) {
        console.log('✅ Esempi nel MasterFile:');
        inMasterFile.slice(0, 5).forEach((p, i) => {
            console.log(`\n${i + 1}. EAN: ${p.eanGtin}`);
            console.log(`   Nome: ${p.nomeProdotto?.substring(0, 60)}...`);
            console.log(`   Marca: ${p.marca}`);
            console.log(`   Categoria: ${p.categoriaEcommerce}`);
            console.log(`   Fornitore: ${p.fornitoreSelezionato?.nomeFornitore}`);
        });
    }

    // 4. Verifica quali sono stati filtrati via
    const missingEans = notebookEans.filter(ean =>
        !inMasterFile.some(m => m.eanGtin === ean)
    );

    if (missingEans.length > 0) {
        console.log(`\n❌ Notebook Asus NON presenti nel MasterFile: ${missingEans.length}`);
        console.log('\nEsempi di prodotti mancanti:');

        const missingProducts = notebooks.filter(p => missingEans.includes(p.eanGtin!));
        missingProducts.slice(0, 5).forEach((p, i) => {
            console.log(`\n${i + 1}. EAN: ${p.eanGtin}`);
            console.log(`   Categoria: ${p.categoriaFornitore}`);
            console.log(`   Descrizione: ${p.descrizioneOriginale?.substring(0, 70)}...`);
        });
    }

    // 5. Mostra tutte le categorie uniche per i prodotti Asus
    console.log('\n' + '='.repeat(70));
    console.log('📊 Categorie uniche per prodotti Asus nel RAW:');
    console.log('='.repeat(70));

    const categories = new Set<string>();
    rawProducts.forEach(p => {
        if (p.categoriaFornitore) {
            categories.add(p.categoriaFornitore);
        }
    });

    const sortedCategories = Array.from(categories).sort();
    console.log(`\nTotale categorie: ${sortedCategories.length}\n`);
    sortedCategories.forEach(cat => {
        const count = rawProducts.filter(p => p.categoriaFornitore === cat).length;
        console.log(`   - ${cat}: ${count} prodotti`);
    });

    console.log('\n' + '='.repeat(70));
}

// Esegui lo script
findAsusNotebooks()
    .catch(error => {
        console.error('❌ Errore:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
