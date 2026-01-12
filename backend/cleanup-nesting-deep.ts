
import prisma from './src/config/database';

async function cleanupNesting() {
    try {
        const outputProducts = await prisma.outputShopify.findMany({
            where: { bodyHtml: { contains: 'product-description' } }
        });

        console.log(`Deep cleaning ${outputProducts.length} products...`);
        let fixed = 0;

        for (const p of outputProducts) {
            if (!p.bodyHtml) continue;

            const matches = [...p.bodyHtml.matchAll(/<div class="product-description"[^>]*>/g)];
            if (matches.length > 1) {
                // Prendi l'ultimo match (il più profondo)
                const lastMatch = matches[matches.length - 1];
                const startIndex = lastMatch.index!;

                // Trova la fine corrispondente. Per semplicità, visto che sappiamo che il contenuto 
                // è strutturato, possiamo prendere tutto quello che c'è dopo il match fino alla fine, 
                // ma dobbiamo bilanciare i div.
                // In realtà, dopo l'ultimo product-description c'è il vero contenuto.

                let content = p.bodyHtml.substring(startIndex + lastMatch[0].length);

                // Rimuoviamo i </div> di chiusura in eccesso che appartenevano ai wrapper esterni
                // Contiamo quanti </div> ci sono
                const closeDivs = [...content.matchAll(/<\/div>/g)];
                if (closeDivs.length > 0) {
                    // Teniamo solo il contenuto fino all'N-esimo div di chiusura dove N è la profondità ?
                    // Troppo complesso. Facciamo così: prendiamo il contenuto e rimuoviamo TUTTI i </div> alla fine.
                    content = content.replace(/(<\/div>\s*)+$/, '');
                }

                const finalHtml = `<div class="product-description" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; max-width: 100%; margin: 0 auto;">${content}</div>`;

                await prisma.outputShopify.update({
                    where: { id: p.id },
                    data: { bodyHtml: finalHtml }
                });

                // Update also DatiIcecat if linked
                const masterFile = await prisma.masterFile.findUnique({
                    where: { id: p.masterFileId },
                    include: { datiIcecat: true }
                });

                if (masterFile?.datiIcecat) {
                    await prisma.datiIcecat.update({
                        where: { id: masterFile.datiIcecat.id },
                        data: { descrizioneLunga: finalHtml }
                    });
                }
                fixed++;
            }
        }
        console.log(`Deep fixed ${fixed} products.`);
    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupNesting();
