import prisma from './src/config/database';

async function cleanupBrokenCategories() {
    console.log('🧹 Avvio pulizia categorie corrotte...');

    // Lista ID categorie identificate come "spazzatura"
    const badIds = [265, 267, 273];
    const numericNames = ['01', '10', '02', '03'];

    // 1. Reset collegamenti nel Master File
    console.log('🔗 Scollegamento prodotti dalle categorie corrotte...');
    const updatedMF = await prisma.masterFile.updateMany({
        where: {
            OR: [
                { categoriaId: { in: badIds } },
                { categoria: { nome: { in: numericNames } } }
            ]
        },
        data: { categoriaId: null }
    });
    console.log(`✅ Prodotti master file aggiornati: ${updatedMF.count}`);

    // 2. Reset collegamenti in Regole Markup
    const updatedRules = await prisma.regolaMarkup.updateMany({
        where: {
            OR: [
                { categoriaId: { in: badIds } },
                { categoria: { nome: { in: numericNames } } }
            ]
        },
        data: { categoriaId: null }
    });
    console.log(`✅ Regole markup aggiornate: ${updatedRules.count}`);

    // 3. Reset collegamenti in Product Filter Rules
    const updatedFilterRules = await prisma.productFilterRule.updateMany({
        where: {
            OR: [
                { categoriaId: { in: badIds } },
                { categoria: { nome: { in: numericNames } } }
            ]
        },
        data: { categoriaId: null }
    });
    console.log(`✅ Regole filtro prodotti aggiornate: ${updatedFilterRules.count}`);

    // 4. (Opzionale) Elimina mappature categorie testuali se necessario
    // Poiché MappaturaCategoria usa nomi stringa e non ID, le lasciamo o le puliamo per nome
    console.log('ℹ️ MappaturaCategoria utilizza nomi testuali, lo skip della pulizia per ID è intenzionale.');

    // 5. Infine, elimina le categorie
    console.log('🗑️ Eliminazione categorie corrotte dal database...');
    const deleted = await prisma.categoria.deleteMany({
        where: {
            OR: [
                { id: { in: badIds } },
                { nome: { in: numericNames } }
            ]
        }
    });

    console.log(`✨ Pulizia completata. Rimosse ${deleted.count} categorie corrotte.`);
    process.exit(0);
}

cleanupBrokenCategories();
