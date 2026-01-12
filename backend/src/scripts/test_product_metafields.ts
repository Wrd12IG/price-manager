import { PrismaClient } from '@prisma/client';
import { ShopifyService } from '../services/ShopifyService';

const prisma = new PrismaClient();

async function testProductMetafields() {
    const ean = '4711387252970';

    try {
        console.log(`=== TESTING PRODUCT ${ean} ===\n`);

        // 1. Check if product exists in ListinoRaw
        console.log('--- Step 1: Checking ListinoRaw ---');
        const rawProduct = await prisma.listinoRaw.findFirst({
            where: { eanGtin: ean },
            include: { fornitore: true }
        });

        if (rawProduct) {
            console.log('✅ Found in ListinoRaw:');
            console.log(`  SKU: ${rawProduct.skuFornitore}`);
            console.log(`  Descrizione: ${rawProduct.descrizioneOriginale}`);
            console.log(`  Marca: ${rawProduct.marca}`);
            console.log(`  Categoria: ${rawProduct.categoriaFornitore}`);
            console.log(`  Prezzo: €${rawProduct.prezzoAcquisto}`);
            console.log(`  Quantità: ${rawProduct.quantitaDisponibile}`);
            console.log(`  Fornitore: ${rawProduct.fornitore.nomeFornitore}`);
        } else {
            console.log('❌ NOT found in ListinoRaw');
        }

        // 2. Check if product exists in MasterFile
        console.log('\n--- Step 2: Checking MasterFile ---');
        const masterProduct = await prisma.masterFile.findUnique({
            where: { eanGtin: ean },
            include: {
                datiIcecat: true,
                fornitoreSelezionato: true
            }
        });

        if (masterProduct) {
            console.log('✅ Found in MasterFile:');
            console.log(`  ID: ${masterProduct.id}`);
            console.log(`  Nome: ${masterProduct.nomeProdotto}`);
            console.log(`  Marca: ${masterProduct.marca}`);
            console.log(`  Categoria: ${masterProduct.categoriaEcommerce}`);
            console.log(`  Prezzo acquisto: €${masterProduct.prezzoAcquistoMigliore}`);
            console.log(`  Prezzo vendita: €${masterProduct.prezzoVenditaCalcolato}`);
            console.log(`  Quantità: ${masterProduct.quantitaTotaleAggregata}`);
            console.log(`  Fornitore: ${masterProduct.fornitoreSelezionato.nomeFornitore}`);

            if (masterProduct.datiIcecat) {
                console.log('\n  ✅ Has Icecat data:');
                console.log(`    Descrizione breve: ${masterProduct.datiIcecat.descrizioneBrave?.substring(0, 60)}...`);
                console.log(`    Descrizione lunga: ${masterProduct.datiIcecat.descrizioneLunga ? 'Yes' : 'No'}`);
                console.log(`    Immagini: ${masterProduct.datiIcecat.urlImmaginiJson ? JSON.parse(masterProduct.datiIcecat.urlImmaginiJson).length : 0}`);

                if (masterProduct.datiIcecat.specificheTecnicheJson) {
                    const specs = JSON.parse(masterProduct.datiIcecat.specificheTecnicheJson);
                    console.log(`    Specifiche tecniche: ${Array.isArray(specs) ? specs.length : 'N/A'} features`);
                }
            } else {
                console.log('\n  ⚠️  NO Icecat data');
            }
        } else {
            console.log('❌ NOT found in MasterFile');
            console.log('\n⚠️  Product needs to be consolidated first!');
            console.log('Run: curl -X POST http://localhost:3001/api/master-file/consolidate');
        }

        // 3. Check if product exists in OutputShopify
        console.log('\n--- Step 3: Checking OutputShopify ---');
        const shopifyOutput = await prisma.outputShopify.findFirst({
            where: {
                masterFile: {
                    eanGtin: ean
                }
            }
        });

        if (shopifyOutput) {
            console.log('✅ Found in OutputShopify:');
            console.log(`  ID: ${shopifyOutput.id}`);
            console.log(`  Handle: ${shopifyOutput.handle}`);
            console.log(`  Title: ${shopifyOutput.title}`);
            console.log(`  Vendor: ${shopifyOutput.vendor}`);
            console.log(`  Product Type: ${shopifyOutput.productType}`);
            console.log(`  Price: €${shopifyOutput.variantPrice}`);
            console.log(`  Status: ${shopifyOutput.statoCaricamento}`);
            console.log(`  Shopify Product ID: ${shopifyOutput.shopifyProductId || 'Not synced yet'}`);

            // Check metafields
            if (shopifyOutput.metafieldsJson) {
                try {
                    const metafields = JSON.parse(shopifyOutput.metafieldsJson);
                    console.log(`\n  ✅ Metafields: ${metafields.length} total`);
                    console.log('\n  Metafields list:');
                    for (const mf of metafields) {
                        const displayValue = mf.value.length > 50 ?
                            mf.value.substring(0, 50) + '...' :
                            mf.value;
                        console.log(`    - ${mf.namespace}.${mf.key} (${mf.type})`);
                        console.log(`      Value: ${displayValue}`);
                    }
                } catch (e) {
                    console.log('  ❌ Error parsing metafields JSON');
                }
            } else {
                console.log('\n  ⚠️  NO metafields');
            }

            // Check images
            if (shopifyOutput.immaginiUrls) {
                try {
                    const images = JSON.parse(shopifyOutput.immaginiUrls);
                    console.log(`\n  Images: ${images.length}`);
                    images.slice(0, 3).forEach((img: string, i: number) => {
                        console.log(`    ${i + 1}. ${img.substring(0, 60)}...`);
                    });
                } catch (e) {
                    console.log('  Error parsing images');
                }
            }

            // Check body HTML
            if (shopifyOutput.bodyHtml) {
                const bodyLength = shopifyOutput.bodyHtml.length;
                console.log(`\n  Body HTML: ${bodyLength} characters`);
                console.log(`  Preview: ${shopifyOutput.bodyHtml.substring(0, 100)}...`);
            }
        } else {
            console.log('❌ NOT found in OutputShopify');
            console.log('\n⚠️  Product needs to be prepared for export!');
            console.log('Run: curl -X POST http://localhost:3001/api/shopify/prepare');
        }

        // 4. Summary and next steps
        console.log('\n=== SUMMARY ===\n');

        const status = {
            inListinoRaw: !!rawProduct,
            inMasterFile: !!masterProduct,
            hasIcecat: !!masterProduct?.datiIcecat,
            inOutputShopify: !!shopifyOutput,
            hasMetafields: !!shopifyOutput?.metafieldsJson,
            syncedToShopify: !!shopifyOutput?.shopifyProductId
        };

        console.log(`✅ In ListinoRaw: ${status.inListinoRaw ? 'Yes' : 'No'}`);
        console.log(`✅ In MasterFile: ${status.inMasterFile ? 'Yes' : 'No'}`);
        console.log(`✅ Has Icecat data: ${status.hasIcecat ? 'Yes' : 'No'}`);
        console.log(`✅ In OutputShopify: ${status.inOutputShopify ? 'Yes' : 'No'}`);
        console.log(`✅ Has Metafields: ${status.hasMetafields ? 'Yes' : 'No'}`);
        console.log(`✅ Synced to Shopify: ${status.syncedToShopify ? 'Yes' : 'No'}`);

        console.log('\n=== NEXT STEPS ===\n');

        if (!status.inMasterFile) {
            console.log('1. ⚠️  Run consolidation to add product to MasterFile');
            console.log('   curl -X POST http://localhost:3001/api/master-file/consolidate');
        } else if (!status.hasIcecat) {
            console.log('1. ⚠️  Run Icecat enrichment to get product details');
            console.log('   curl -X POST http://localhost:3001/api/icecat/enrich');
        } else if (!status.inOutputShopify) {
            console.log('1. ⚠️  Run Shopify prepare to generate metafields');
            console.log('   curl -X POST http://localhost:3001/api/shopify/prepare');
        } else if (!status.syncedToShopify) {
            console.log('1. ✅ Ready to sync to Shopify!');
            console.log('   curl -X POST http://localhost:3001/api/shopify/sync');
        } else {
            console.log('1. ✅ Product is fully synced!');
            console.log(`   Check on Shopify: https://admin.shopify.com/store/YOUR_STORE/products/${shopifyOutput?.shopifyProductId}`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testProductMetafields();
