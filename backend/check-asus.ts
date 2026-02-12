import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function checkAsusProduct() {
    try {
        console.log('🔍 Ricerca prodotto ASUS ROG Strix G16...\n');

        const products = await prisma.masterFile.findMany({
            where: {
                OR: [
                    { nomeProdotto: { contains: 'G615', mode: 'insensitive' } },
                    { nomeProdotto: { contains: 'Strix', mode: 'insensitive' } },
                    { nomeProdotto: { contains: '14650HX', mode: 'insensitive' } },
                    { nomeProdotto: { contains: 'RTX 4060', mode: 'insensitive' } }
                ]
            },
            include: {
                marchio: true,
                categoria: true,
                outputShopify: true,
                datiIcecat: true
            },
            take: 3
        });

        if (products.length === 0) {
            console.log('❌ Nessun prodotto trovato con i criteri specificati\n');

            console.log('Ricerca prodotti ASUS...');
            const asusProducts = await prisma.masterFile.findMany({
                where: {
                    marchio: { nome: { contains: 'ASUS', mode: 'insensitive' } }
                },
                take: 5,
                select: { nomeProdotto: true, eanGtin: true }
            });

            console.log(`\nTrovati ${asusProducts.length} prodotti ASUS:`);
            asusProducts.forEach(p => console.log(`  - ${p.nomeProdotto} (${p.eanGtin})`));
        } else {
            for (const product of products) {
                console.log('='.repeat(80));
                console.log('📦 PRODOTTO:', product.nomeProdotto);
                console.log('EAN:', product.eanGtin);
                console.log('Marca:', product.marchio?.nome || 'N/A');
                console.log('Categoria:', product.categoria?.nome || 'N/A');

                console.log('\n📊 DATI ICECAT:');
                console.log('Ha dati Icecat:', !!product.datiIcecat);
                if (product.datiIcecat) {
                    console.log('Descrizione breve:', product.datiIcecat.descrizioneBrave ? 'SI' : 'NO');
                    console.log('Descrizione lunga:', product.datiIcecat.descrizioneLunga ? 'SI' : 'NO');
                    console.log('Ha specifiche:', !!product.datiIcecat.specificheTecnicheJson);

                    if (product.datiIcecat.specificheTecnicheJson) {
                        try {
                            const specs = JSON.parse(product.datiIcecat.specificheTecnicheJson);
                            console.log('Numero specifiche:', Array.isArray(specs) ? specs.length : Object.keys(specs).length);
                        } catch (e) {
                            console.log('Errore nel parsing specifiche');
                        }
                    }
                }

                console.log('\n🏪 OUTPUT SHOPIFY:');
                console.log('Ha record OutputShopify:', !!product.outputShopify);
                if (product.outputShopify) {
                    console.log('Stato caricamento:', product.outputShopify.statoCaricamento);
                    console.log('Shopify Product ID:', product.outputShopify.shopifyProductId || 'N/A');

                    console.log('\n🏷️  METAFIELDS:');
                    if (product.outputShopify.metafieldsJson) {
                        try {
                            const meta = JSON.parse(product.outputShopify.metafieldsJson);
                            const keys = Object.keys(meta);
                            console.log(`Numero metafields: ${keys.length}\n`);

                            keys.forEach(key => {
                                const value = String(meta[key]);
                                const preview = value.length > 70 ? value.substring(0, 70) + '...' : value;
                                console.log(`  ✓ ${key}`);
                                console.log(`    ${preview}\n`);
                            });
                        } catch (e) {
                            console.log('⚠️  Errore nel parsing metafieldsJson');
                        }
                    } else {
                        console.log('⚠️  Nessun metafield generato (metafieldsJson è NULL)');
                    }
                } else {
                    console.log('⚠️  Nessun record in OutputShopify per questo prodotto');
                }
                console.log('');
            }
        }

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkAsusProduct();
