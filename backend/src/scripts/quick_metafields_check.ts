import prisma from '../config/database';

async function quickCheck() {
    try {
        // Prendi un solo prodotto
        const product = await prisma.outputShopify.findFirst({
            where: { metafieldsJson: { not: null } },
            select: {
                title: true,
                handle: true,
                metafieldsJson: true
            }
        });

        if (!product) {
            console.log('Nessun prodotto trovato');
            return;
        }

        console.log('Prodotto:', product.title);
        console.log('Handle:', product.handle);
        console.log('\nMetafields:');

        const metafields = JSON.parse(product.metafieldsJson!);
        console.log(`Totale: ${metafields.length}\n`);

        metafields.forEach((mf: any, i: number) => {
            console.log(`${i + 1}. ${mf.namespace}.${mf.key} = ${mf.value.substring(0, 50)}...`);
        });

    } catch (error) {
        console.error('Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

quickCheck();
