import prisma from '../config/database';

async function diagnoseBrixiaIssues() {
    console.log('🔍 Diagnosi Avanzata Utente Brixia (ID 4)...\n');

    const utenteId = 4;

    // 1. Verifica Marchi presenti
    console.log('🏷️ Analisi Marchi nel MasterFile:');
    const brands: any = await prisma.$queryRaw`
        SELECT m.nome as brand_name, COUNT(*) as count
        FROM master_file mf
        LEFT JOIN marchi m ON mf."marchioId" = m.id
        WHERE mf."utenteId" = ${utenteId}
        GROUP BY m.nome
        ORDER BY count DESC
    `;

    if (brands.length === 0) {
        console.log('   ⚠️ Nessun prodotto nel MasterFile per questo utente.');
    } else {
        brands.forEach((b: any) => {
            console.log(`   - ${b.brand_name || 'Nessun Marchio Assigned'}: ${b.count} prodotti`);
        });
    }

    // 2. Cerca prodotti che contengono "ASUS" nel nome
    console.log('\n🔍 Ricerca testuale "ASUS" nel nome prodotto:');
    const asusProducts = await prisma.masterFile.findMany({
        where: {
            utenteId,
            nomeProdotto: { contains: 'ASUS', mode: 'insensitive' }
        },
        select: {
            id: true,
            nomeProdotto: true,
            marchio: { select: { nome: true } }
        },
        take: 5
    });

    if (asusProducts.length > 0) {
        console.log(`   ✅ Trovati ${asusProducts.length} prodotti con "ASUS" nel nome:`);
        asusProducts.forEach(p => {
            console.log(`   - [ID: ${p.id}] ${p.nomeProdotto} (Brand: ${p.marchio?.nome || 'N/A'})`);
        });
    } else {
        console.log('   ❌ Nessun prodotto trovato con "ASUS" nel nome.');
    }

    // 3. Verifica Integrità Fornitori (per il problema cancellazione)
    console.log('\n📦 Stato Fornitori:');
    const fornitori = await prisma.fornitore.findMany({
        where: { utenteId },
        include: {
            _count: {
                select: {
                    listiniRaw: true,
                    masterFileRecords: true,
                    regoleMarkup: true,
                    mappatureCampi: true,
                    mappatureCategorie: true
                }
            }
        }
    });

    fornitori.forEach(f => {
        console.log(`   - ${f.nomeFornitore} (ID: ${f.id})`);
        console.log(`     - Listini Raw: ${f._count.listiniRaw}`);
        console.log(`     - Prodotti MasterFile: ${f._count.masterFileRecords}`);
        console.log(`     - Regole Markup: ${f._count.regoleMarkup}`);
        console.log(`     - Mappature: ${f._count.mappatureCampi} campi, ${f._count.mappatureCategorie} categorie`);
    });

    // 4. Verifica se ci sono SupplierFilters (potrebbero bloccare la cancellazione se non gestiti)
    console.log('\n📑 Supplier Filters:');
    const filters = await prisma.supplierFilter.findMany({
        where: { utenteId }
    });
    console.log(`   Totale filtri: ${filters.length}`);
    filters.forEach(filter => {
        console.log(`   - Filtro: ${filter.nome} (Fornitore ID: ${filter.fornitoreId})`);
    });

    await prisma.$disconnect();
}

diagnoseBrixiaIssues().catch(console.error);
