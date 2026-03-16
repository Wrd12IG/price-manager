import { IcecatService } from './services/IcecatService';
import prisma from './config/database';

async function enrichment() {
    const utenteId = 1;
    console.log(`🚀 Avvio arricchimento massivo per Utente ${utenteId}...`);
    
    const products = await prisma.masterFile.findMany({
        where: {
            utenteId,
            // Arricchiamo quelli che non hanno ancora dati o che hanno categoria nulla
            OR: [
                { datiIcecat: null },
                { datiIcecat: { categoriaIcecat: null } }
            ],
            eanGtin: { not: '' }
        },
        include: { marchio: { select: { nome: true } } },
        take: 300 // Un numero ragionevole per iniziare
    });

    console.log(`🔍 Trovati ${products.length} prodotti da arricchire.`);

    const credentials = await IcecatService.getCredentials(utenteId);

    let count = 0;
    for (const p of products) {
        if (!p.eanGtin) continue;
        count++;
        process.stdout.write(`\r📦 [${count}/${products.length}] Arricchimento ${p.eanGtin}...`);
        
        try {
            await IcecatService.enrichSingleProduct(utenteId, p, credentials);
        } catch (e: any) {
            console.error(`\n❌ Errore per ${p.eanGtin}:`, e.message);
        }
        
        // Piccolo delay per non saturare l'API
        await new Promise(r => setTimeout(r, 200));
    }

    console.log('\n✅ Arricchimento completato.');
    
    console.log('🔄 Avvio ricalcolo categorie nel MasterFile...');
    const result = await IcecatService.enrichMasterFile(utenteId); // Questo metodo internally chiama normalizeCategoriesFromIcecat
    console.log(`✨ Risultato: ${JSON.stringify(result)}`);

    await prisma.$disconnect();
}

enrichment().catch(console.error);
