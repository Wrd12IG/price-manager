
import prisma from '../config/database';
import { ShopifyService } from '../services/ShopifyService';

async function regenerate() {
    console.log('🔄 RIGENERAZIONE METAFIELDS SHOPIFY\n');
    try {
        await ShopifyService.prepareExport();
        console.log('✅ Metafields rigenerati con successo!');

        // Verifica un esempio
        const sample = await prisma.outputShopify.findFirst({
            where: { metafieldsJson: { contains: 'custom.cpu' } },
            select: { title: true, metafieldsJson: true }
        });

        if (sample) {
            console.log(`\nEsempio (${sample.title}):`);
            const mfs = JSON.parse(sample.metafieldsJson!);
            mfs.forEach((m: any) => {
                if (['cpu', 'ram', 'capacita_ssd'].includes(m.key)) {
                    console.log(`  - ${m.key}: ${m.value}`);
                }
            });
        }

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

regenerate();
