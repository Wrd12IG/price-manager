
import prisma from './src/config/database';

async function main() {
    console.log('--- Configurazione Sistema (shopify_category_mapping) ---');
    const mapping = await prisma.configurazioneSistema.findFirst({
        where: { chiave: 'shopify_category_mapping' }
    });
    console.log(mapping ? mapping.valore : 'Non trovato');

    console.log('\n--- Regole di Filtro Attive ---');
    const rules = await prisma.productFilterRule.findMany({
        where: { attiva: true },
        include: { marchio: true, categoria: true }
    });
    console.log(JSON.stringify(rules, null, 2));

    console.log('\n--- Prodotti Monitor nel MasterFile ---');
    const monitors = await prisma.masterFile.findMany({
        where: {
            OR: [
                { nomeProdotto: { contains: 'monitor', mode: 'insensitive' } },
                { categoria: { nome: { contains: 'monitor', mode: 'insensitive' } } }
            ]
        },
        include: {
            categoria: true,
            outputShopify: true
        },
        take: 10
    });
    
    monitors.forEach(m => {
        console.log(`ID: ${m.id}, Nome: ${m.nomeProdotto}, Cat: ${m.categoria?.nome}, Stato Shopify: ${m.outputShopify?.statoCaricamento || 'Nessuno'}`);
    });

    console.log('\n--- Prodotto di esempio con titolo lungo ---');
    const longTitles = await prisma.outputShopify.findMany({
        where: {
            title: { contains: ' ', mode: 'insensitive' }
        },
        orderBy: {
            title: 'desc'
        },
        take: 5
    });
    longTitles.forEach(t => {
        console.log(`Title: ${t.title}\nLength: ${t.title.length}\n`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
