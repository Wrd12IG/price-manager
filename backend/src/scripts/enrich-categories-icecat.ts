import { IcecatService } from '../services/IcecatService';
import prisma from '../config/database';

async function enrichment() {
    console.log('🚀 Avvio arricchimento categorie da Icecat...');
    
    // Per test, prendiamo i prodotti ASUS AIO e Monitor che erano il problema iniziale
    const products = await prisma.masterFile.findMany({
        where: {
            OR: [
                { nomeProdotto: { contains: 'asus', mode: 'insensitive' } },
                { nomeProdotto: { contains: 'monitor', mode: 'insensitive' } },
                { nomeProdotto: { contains: 'aio', mode: 'insensitive' } }
            ]
        },
        take: 50
    });

    console.log(`🔍 Trovati ${products.length} prodotti ASUS/Monitor/AIO da arricchire.`);

    const credentials = await IcecatService.getCredentials(1);

    for (const p of products) {
        if (!p.eanGtin) continue;
        console.log(`📦 Arricchimento ${p.eanGtin} (${p.nomeProdotto?.substring(0, 30)})...`);
        try {
            await IcecatService.enrichSingleProduct(1, p, credentials);
        } catch (e: any) {
            console.error(`❌ Errore per ${p.eanGtin}:`, e.message);
        }
    }

    console.log('✅ Arricchimento completato.');
    await prisma.$disconnect();
}

enrichment().catch(console.error);
