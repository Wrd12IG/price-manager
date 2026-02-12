import prisma from './src/config/database';

async function showSampleMetafields() {
    const SANTE_USER_ID = 2;

    try {
        console.log('🔍 Verifica Metafields Generati per Sante\n');

        // Prendi un prodotto recente con metafields
        const product = await prisma.outputShopify.findFirst({
            where: {
                utenteId: SANTE_USER_ID,
                metafieldsJson: { not: null }
            },
            orderBy: { updatedAt: 'desc' }
        });

        if (!product) {
            console.log('⚠️  Nessun prodotto con metafields trovato');
            await prisma.$disconnect();
            return;
        }

        console.log('='.repeat(80));
        console.log('📦 ESEMPIO METAFIELDS GENERATI');
        console.log('='.repeat(80));
        console.log(`Prodotto: ${product.title}`);
        console.log(`SKU: ${product.sku}`);
        console.log(`Stato: ${product.statoCaricamento}\n`);

        const metafields = JSON.parse(product.metafieldsJson || '{}');
        const keys = Object.keys(metafields);

        console.log(`🏷️  Numero totale metafields: ${keys.length}\n`);
        console.log('Metafields disponibili:\n');

        keys.sort().forEach(key => {
            const value = metafields[key];
            let displayValue = String(value);

            // Tronca valori lunghi
            if (displayValue.length > 100) {
                displayValue = displayValue.substring(0, 100) + '...';
            }

            // Evidenzia i metafields nuovi (quelli che prima mancavano)
            const isNew = [
                'custom.processore_brand',
                'custom.ram',
                'custom.capacita_ssd',
                'custom.scheda_video',
                'custom.sistema_operativo',
                'custom.dimensione_monitor',
                'custom.risoluzione_monitor',
                'custom.tipo_pc',
                'custom.rapporto_aspetto',
                'custom.peso',
                'custom.batteria',
                'custom.connettivita',
                'custom.porte'
            ].includes(key);

            const marker = isNew ? '✨ ' : '  ';
            console.log(`${marker}${key}:`);
            console.log(`   ${displayValue}\n`);
        });

        console.log('='.repeat(80));
        console.log('✨ = Metafields NUOVI (prima mancavano)');
        console.log('='.repeat(80));

        await prisma.$disconnect();

    } catch (error: any) {
        console.error('Errore:', error.message);
        await prisma.$disconnect();
    }
}

showSampleMetafields();
