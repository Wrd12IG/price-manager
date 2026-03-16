import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function updateCategories() {
    console.log('🚀 Avvio aggiornamento forzato categorie per export Shopify...');
    
    // 1. Recupera la mappatura delle categorie (se presente)
    const config = await prisma.configurazioneSistema.findFirst({
        where: { chiave: 'shopify_category_mapping' }
    });
    const mapping = config && config.valore ? JSON.parse(config.valore) : {};

    // 2. Trova tutti i prodotti già caricati che hanno un MasterFile associato
    const products = await prisma.outputShopify.findMany({
        where: {
            statoCaricamento: 'uploaded',
            shopifyProductId: { not: null }
        },
        include: {
            masterFile: {
                include: {
                    categoria: true
                }
            }
        }
    });

    console.log(`📊 Trovati ${products.length} prodotti da analizzare.`);

    let updatedCount = 0;

    for (const p of products) {
        if (!p.masterFile || !p.masterFile.categoria) continue;

        const categoriaNome = p.masterFile.categoria.nome;
        
        // Risolvi il productType (logica simile a ShopifyExportService.resolveProductType)
        let productType = mapping[categoriaNome] || categoriaNome;
        
        // Se la categoria attuale nell'export è diversa da quella nel MasterFile
        if (p.productType !== productType) {
            console.log(`✨ Aggiornamento categoria per ${p.sku}: "${p.productType}" -> "${productType}"`);
            
            // Aggiorna anche il metafield custom.categoria_prodotto se presente
            let metafields = {};
            try {
                metafields = p.metafieldsJson ? JSON.parse(p.metafieldsJson) : {};
                metafields['custom.categoria_prodotto'] = categoriaNome;
            } catch (e) {}

            await prisma.outputShopify.update({
                where: { id: p.id },
                data: {
                    productType: productType,
                    metafieldsJson: JSON.stringify(metafields),
                    statoCaricamento: 'image_update' // Usiamo image_update per forzare un update completo (incluso productType)
                }
            });
            updatedCount++;
        }
    }

    console.log(`✅ Operazione completata. ${updatedCount} prodotti segnati per il re-sync delle categorie.`);
    await prisma.$disconnect();
}

updateCategories().catch(console.error);
