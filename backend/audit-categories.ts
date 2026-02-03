import prisma from './src/config/database';

async function auditCategories() {
    console.log('🔍 Analisi categorie sospette...');

    // Cerca categorie con nomi sospetti (troppo lunghi o contenenti pipe '|')
    const suspiciousCategories = await prisma.categoria.findMany({
        where: {
            OR: [
                { nome: { contains: '|' } },
                { nome: { contains: ';' } },
                { nome: { contains: '120"' } } // Dal pezzetto dell'immagine
            ]
        }
    });

    console.log(`Trovate ${suspiciousCategories.length} categorie sospette.`);

    for (const cat of suspiciousCategories) {
        console.log(`- ID: ${cat.id}, Nome: "${cat.nome.substring(0, 100)}..."`);
    }

    // Controlliamo anche se ci sono categorie con nomi numerici tipo "01", "10" come visto nell'immagine
    const numericCategories = await prisma.categoria.findMany({
        where: {
            nome: {
                in: ['01', '10', '02', '03']
            }
        }
    });

    console.log(`\nTrovate ${numericCategories.length} categorie numeriche (potrebbero essere codici non mappati correttamente).`);
    for (const cat of numericCategories) {
        process.stdout.write(`${cat.nome} (ID ${cat.id}), `);
    }
    console.log('\n');

    process.exit(0);
}

auditCategories();
