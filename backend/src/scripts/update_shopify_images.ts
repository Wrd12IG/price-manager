import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateShopifyOutputWithImages() {
    try {
        console.log('\n📤 ===== AGGIORNAMENTO OUTPUT SHOPIFY CON IMMAGINI =====\n');

        const utenteId = 3;

        // Trova prodotti OutputShopify senza immagini ma che hanno dati ICECAT
        const productsToUpdate = await prisma.outputShopify.findMany({
            where: {
                utenteId,
                OR: [
                    { immaginiUrls: null },
                    { immaginiUrls: '[]' }
                ]
            },
            include: {
                masterFile: {
                    include: { datiIcecat: true }
                }
            }
        });

        console.log(`📊 Prodotti da aggiornare: ${productsToUpdate.length}`);

        let updated = 0;
        for (const output of productsToUpdate) {
            const icecat = output.masterFile?.datiIcecat;

            if (icecat && icecat.urlImmaginiJson && icecat.urlImmaginiJson !== '[]') {
                await prisma.outputShopify.update({
                    where: { id: output.id },
                    data: {
                        immaginiUrls: icecat.urlImmaginiJson,
                        descrizioneBreve: icecat.descrizioneBrave,
                        specificheJson: icecat.specificheTecnicheJson,
                        bodyHtml: icecat.descrizioneLunga
                            ? `<div class="product-description">${icecat.descrizioneLunga}</div>`
                            : output.bodyHtml
                    }
                });
                updated++;
            }
        }

        console.log(`✅ Aggiornati: ${updated} prodotti`);

        // Ora crea i record OutputShopify mancanti
        const missingProducts = await prisma.masterFile.findMany({
            where: {
                utenteId,
                outputShopify: null
            },
            include: {
                marchio: true,
                categoria: true,
                datiIcecat: true
            }
        });

        console.log(`\n📦 Prodotti senza OutputShopify: ${missingProducts.length}`);

        if (missingProducts.length > 0) {
            const dataToCreate = missingProducts.map(p => {
                const title = p.nomeProdotto || `Prodotto ${p.eanGtin}`;

                let immaginiUrls: string | null = null;
                let descrizioneBreve: string | null = null;
                let specificheJson: string | null = null;
                let bodyHtml = `<p>${title}</p>`;

                if (p.datiIcecat) {
                    if (p.datiIcecat.urlImmaginiJson && p.datiIcecat.urlImmaginiJson !== '[]') {
                        immaginiUrls = p.datiIcecat.urlImmaginiJson;
                    }
                    if (p.datiIcecat.descrizioneBrave) {
                        descrizioneBreve = p.datiIcecat.descrizioneBrave;
                    }
                    if (p.datiIcecat.descrizioneLunga) {
                        bodyHtml = `<div class="product-description">${p.datiIcecat.descrizioneLunga}</div>`;
                    }
                    if (p.datiIcecat.specificheTecnicheJson) {
                        specificheJson = p.datiIcecat.specificheTecnicheJson;
                    }
                }

                return {
                    utenteId,
                    masterFileId: p.id,
                    handle: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${p.id}`,
                    title: title,
                    bodyHtml: bodyHtml,
                    vendor: p.marchio?.nome || 'Generico',
                    productType: p.categoria?.nome || 'Hardware',
                    sku: p.partNumber || `SKU-${p.id}`,
                    barcode: p.eanGtin,
                    variantPrice: p.prezzoVenditaCalcolato || 0,
                    variantInventoryQty: p.quantitaTotaleAggregata || 0,
                    immaginiUrls: immaginiUrls,
                    descrizioneBreve: descrizioneBreve,
                    specificheJson: specificheJson,
                    statoCaricamento: 'pending'
                };
            });

            await prisma.outputShopify.createMany({
                data: dataToCreate,
                skipDuplicates: true
            });

            const withImages = dataToCreate.filter(d => d.immaginiUrls).length;
            console.log(`✅ Creati ${dataToCreate.length} nuovi record (${withImages} con immagini)`);
        }

        // Verifica finale
        const totalOutput = await prisma.outputShopify.count({ where: { utenteId } });
        const outputWithImages = await prisma.outputShopify.count({
            where: {
                utenteId,
                immaginiUrls: { not: null },
                NOT: { immaginiUrls: '[]' }
            }
        });

        console.log(`\n📊 STATO FINALE OUTPUT SHOPIFY:`);
        console.log(`   Totale: ${totalOutput}`);
        console.log(`   Con immagini: ${outputWithImages}`);
        console.log(`   Senza immagini: ${totalOutput - outputWithImages}`);

        console.log('\n✅ Completato!\n');

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateShopifyOutputWithImages();
