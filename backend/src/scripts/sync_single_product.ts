import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import dotenv from 'dotenv';
import { decrypt } from '../utils/encryption';

import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function syncSingleProduct() {
    const ean = '4711387252970';

    try {
        console.log(`=== SYNCING PRODUCT ${ean} TO SHOPIFY ===\n`);

        // 1. Get OutputShopify record
        const p = await prisma.outputShopify.findFirst({
            where: { masterFile: { eanGtin: ean } }
        });

        if (!p) {
            console.log('❌ Product not found in OutputShopify');
            return;
        }

        console.log(`Found product: ${p.title}`);
        console.log(`Status: ${p.statoCaricamento}`);

        // 2. Prepare Shopify credentials from DB
        const configUrl = await prisma.configurazioneSistema.findFirst({ where: { chiave: 'shopify_shop_url' } });
        const configToken = await prisma.configurazioneSistema.findFirst({ where: { chiave: 'shopify_access_token' } });

        if (!configUrl || !configToken) {
            console.log('❌ Missing Shopify configuration in database');
            return;
        }

        const shopUrl = configUrl.valore;
        const accessToken = decrypt(configToken.valore);
        const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01';

        console.log(`Syncing to: ${shopUrl}`);

        // 3. Prepare payload
        let images: any[] = [];
        if (p.immaginiUrls) {
            try {
                const urlsArray = JSON.parse(p.immaginiUrls);
                if (Array.isArray(urlsArray)) {
                    images = urlsArray.map((url: string, index: number) => ({
                        src: url,
                        position: index + 1,
                        alt: p.title
                    }));
                }
            } catch (e) {
                console.log('Error parsing images');
            }
        }

        let metafields: any[] = [];
        if (p.metafieldsJson) {
            try {
                metafields = JSON.parse(p.metafieldsJson);
            } catch (e) {
                console.log('Error parsing metafields');
            }
        }

        const productData = {
            product: {
                title: p.title,
                body_html: p.bodyHtml,
                vendor: p.vendor,
                product_type: p.productType,
                tags: p.tags || '',
                images: images,
                variants: [
                    {
                        price: p.variantPrice,
                        inventory_quantity: p.variantInventoryQty,
                        inventory_management: 'shopify',
                        sku: p.handle // Using handle as SKU for consistency
                    }
                ]
            }
        };

        // 4. Create Product
        console.log('Creating product on Shopify...');

        let productId: string;
        try {
            const response = await axios.post(
                `https://${shopUrl}/admin/api/${apiVersion}/products.json`,
                productData,
                { headers: { 'X-Shopify-Access-Token': accessToken } }
            );

            productId = String(response.data.product.id);
            console.log(`✅ Product created! ID: ${productId}`);

            // Update DB
            await prisma.outputShopify.update({
                where: { id: p.id },
                data: {
                    shopifyProductId: productId,
                    statoCaricamento: 'uploaded'
                }
            });

        } catch (error: any) {
            console.log(`❌ Error creating product: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
            return;
        }

        // 5. Sync Metafields
        if (metafields && metafields.length > 0) {
            console.log(`\nSyncing ${metafields.length} metafields...`);

            for (const metafield of metafields) {
                try {
                    console.log(`  - Sending ${metafield.key}...`);
                    await axios.post(
                        `https://${shopUrl}/admin/api/${apiVersion}/products/${productId}/metafields.json`,
                        {
                            metafield: {
                                namespace: metafield.namespace,
                                key: metafield.key,
                                value: metafield.value,
                                type: metafield.type
                            }
                        },
                        { headers: { 'X-Shopify-Access-Token': accessToken } }
                    );

                    // Rate limit
                    await new Promise(r => setTimeout(r, 200));
                } catch (error: any) {
                    console.log(`    ⚠️ Error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
                }
            }
            console.log('✅ Metafields sync completed!');
        } else {
            console.log('No metafields to sync.');
        }

        console.log(`\nCheck product at: https://admin.shopify.com/store/${shopUrl.split('.')[0]}/products/${productId}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

syncSingleProduct();
