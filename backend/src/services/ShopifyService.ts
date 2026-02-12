// @ts-nocheck
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { ShopifyExportService } from './ShopifyExportService';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import { jobProgressManager } from './JobProgressService';

export class ShopifyService {

    static async getConfig(utenteId: number): Promise<{ shopUrl: string; configured: boolean; placeholderImageUrl: string }> {
        const configs = await prisma.configurazioneSistema.findMany({
            where: {
                utenteId,
                chiave: { in: ['shopify_shop_url', 'shopify_access_token', 'shopify_placeholder_image'] }
            }
        });

        const shopUrl = configs.find(c => c.chiave === 'shopify_shop_url')?.valore || '';
        const accessToken = configs.find(c => c.chiave === 'shopify_access_token')?.valore || '';
        const placeholder = configs.find(c => c.chiave === 'shopify_placeholder_image')?.valore || '';

        return {
            shopUrl,
            configured: !!(shopUrl && accessToken),
            placeholderImageUrl: placeholder
        };
    }

    private static async getAccessToken(utenteId: number): Promise<string | null> {
        const config = await prisma.configurazioneSistema.findFirst({
            where: { utenteId, chiave: 'shopify_access_token' }
        });
        if (!config || !config.valore) return null;

        const encryptionKey = process.env.ENCRYPTION_KEY || '32-char-secret-key-for-aes-256';
        try {
            const bytes = CryptoJS.AES.decrypt(config.valore, encryptionKey);
            return bytes.toString(CryptoJS.enc.Utf8);
        } catch (e) {
            logger.error(`Errore decriptazione token Shopify per utente ${utenteId}`);
            return null;
        }
    }

    static async saveConfig(utenteId: number, shopUrl: string, accessToken: string): Promise<void> {
        const encryptionKey = process.env.ENCRYPTION_KEY || '32-char-secret-key-for-aes-256';
        const encryptedToken = CryptoJS.AES.encrypt(accessToken, encryptionKey).toString();

        await prisma.configurazioneSistema.upsert({
            where: { utenteId_chiave: { utenteId, chiave: 'shopify_shop_url' } },
            create: { utenteId, chiave: 'shopify_shop_url', valore: shopUrl },
            update: { valore: shopUrl }
        });

        await prisma.configurazioneSistema.upsert({
            where: { utenteId_chiave: { utenteId, chiave: 'shopify_access_token' } },
            create: { utenteId, chiave: 'shopify_access_token', valore: encryptedToken },
            update: { valore: encryptedToken }
        });
    }

    static async syncProducts(utenteId: number): Promise<{ success: number, errors: number, total: number }> {
        logger.info(`🔄 [Utente ${utenteId}] Sincronizzazione Shopify`);

        const config = await this.getConfig(utenteId);
        if (!config.configured) throw new Error('Shopify non configurato');

        const token = await this.getAccessToken(utenteId);
        if (!token) throw new Error('Token Shopify mancante');

        // Creiamo il job subito per mostrare il progresso della preparazione
        const jobId = jobProgressManager.createJob('export', { utenteId });
        jobProgressManager.startJob(jobId, 'Preparazione dati per Shopify...');

        // Genera o aggiorna i record per l'export (passiamo jobId per il tracking interno)
        await ShopifyExportService.generateExport(utenteId, jobId);

        const products = await prisma.outputShopify.findMany({
            where: { utenteId, statoCaricamento: { not: 'uploaded' } },
            take: 250
        });

        if (products.length === 0) {
            jobProgressManager.completeJob(jobId, 'Nessun prodotto da sincronizzare');
            return { success: 0, errors: 0, total: 0 };
        }

        // Aggiorniamo il totale nel job per il calcolo percentuale corretta
        const job = jobProgressManager.getJob(jobId);
        if (job && job.metadata) {
            job.metadata.total = products.length;
        }

        jobProgressManager.updateProgress(jobId, 0, `Invio di ${products.length} prodotti a Shopify...`);

        let success = 0;
        let errors = 0;

        for (const p of products) {
            try {
                const cleanShopUrl = config.shopUrl.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '').split('/')[0];
                const shopifyUrl = `https://${cleanShopUrl}/admin/api/2024-01/products.json`;

                logger.debug(`[Shopify] Sync URL: ${shopifyUrl}`);

                // Prepara Metafields
                const metafields = [];
                if (p.metafieldsJson) {
                    try {
                        const mData = JSON.parse(p.metafieldsJson);
                        Object.entries(mData).forEach(([fullKey, value]) => {
                            if (!value) return;
                            const [namespace, key] = fullKey.includes('.') ? fullKey.split('.') : ['custom', fullKey];

                            // Determina il tipo in base al valore o alla chiave (deve coincidere con le definizioni in Shopify)
                            let type = 'single_line_text_field';
                            if (value.length > 255 || value.includes('\n') || value.includes('<')) {
                                type = 'multi_line_text_field';
                            }
                            // Campi specifici che in questo store sono definiti come multi_line_text_field
                            const multiLineKeys = ['descrizione_lunga', 'tabella_specifiche', 'descrizione_breve', 'ean'];
                            if (multiLineKeys.includes(key)) {
                                type = 'multi_line_text_field';
                            }

                            metafields.push({
                                namespace,
                                key,
                                value: String(value),
                                type: type
                            });
                        });
                    } catch (e) {
                        logger.error(`Errore parsing metafields per prodotto ${p.id}`);
                    }
                }

                // Prepara Immagini
                let images = [];
                if (p.immaginiUrls) {
                    try {
                        const urls = JSON.parse(p.immaginiUrls);
                        if (Array.isArray(urls)) {
                            images = urls.map(url => ({ src: url }));
                        }
                    } catch (e) {
                        logger.error(`Errore parsing immagini per prodotto ${p.id}`);
                    }
                }

                // Determina stato in base al prezzo
                const isPriceMissing = !p.variantPrice || parseFloat(String(p.variantPrice)) <= 0;
                const status = isPriceMissing ? 'draft' : 'active';
                const tags = isPriceMissing ? `${p.tags}, Prezzo Mancante` : p.tags;

                // Retry logic per chiamate Shopify
                let attempts = 0;
                const maxAttempts = 3;
                let productSynced = false;

                let productId: string | null = null;
                while (attempts < maxAttempts && !productSynced) {
                    try {
                        attempts++;
                        // ❌ NON inviare metafields nel payload del prodotto - Shopify li ignora!
                        const productPayload = {
                            product: {
                                title: p.title,
                                body_html: p.bodyHtml,
                                vendor: p.vendor,
                                product_type: p.productType,
                                status: status,
                                tags: tags,
                                variants: [{
                                    sku: p.sku,
                                    barcode: p.barcode,
                                    price: p.variantPrice || 0,
                                    inventory_quantity: p.variantInventoryQty
                                    // inventory_management: 'shopify' // Rimosso temporaneamente per evitare errore "Feature is disabled"
                                }],
                                images: images.length > 0 ? images : undefined
                            }
                        };

                        const response = await axios.post(shopifyUrl, productPayload, {
                            headers: { 'X-Shopify-Access-Token': token },
                            timeout: 60000
                        });

                        logger.info(`✅ Prodotto ${p.sku} sincronizzato con successo. Shopify ID: ${response.data?.product?.id}`);
                        productSynced = true;
                        productId = response.data?.product?.id;
                    } catch (e: any) {
                        const isLastAttempt = attempts === maxAttempts;
                        const isTimeout = e.code === 'ECONNABORTED' || e.message.includes('timeout');

                        if (isLastAttempt) {
                            throw e;
                        }

                        logger.warn(`Tentativo ${attempts} fallito per ${p.sku}. Errore: ${e.response?.data ? JSON.stringify(e.response.data) : e.message}. Riprovo...`);
                        await new Promise(res => setTimeout(res, 2000 * attempts));
                    }
                }

                // ✅ SYNC METAFIELDS SEPARATAMENTE (dopo la creazione del prodotto)
                if (productId && metafields.length > 0) {
                    logger.info(`📝 Sincronizzazione ${metafields.length} metafields per prodotto ${p.sku} (ID: ${productId})`);

                    for (const metafield of metafields) {
                        try {
                            await axios.post(
                                `https://${cleanShopUrl}/admin/api/2024-01/products/${productId}/metafields.json`,
                                {
                                    metafield: {
                                        namespace: metafield.namespace,
                                        key: metafield.key,
                                        value: metafield.value,
                                        type: metafield.type
                                    }
                                },
                                {
                                    headers: { 'X-Shopify-Access-Token': token },
                                    timeout: 30000
                                }
                            );
                            logger.debug(`✅ Metafield ${metafield.namespace}.${metafield.key} sincronizzato`);
                            await new Promise(r => setTimeout(r, 100));
                        } catch (metaError: any) {
                            if (metaError.response?.status === 422) {
                                logger.warn(`⚠️ Metafield ${metafield.namespace}.${metafield.key} già esistente per prodotto ${p.sku}`);
                            } else {
                                logger.error(`❌ Errore sync metafield ${metafield.namespace}.${metafield.key} per prodotto ${p.sku}:`, metaError.message);
                            }
                        }
                    }
                    logger.info(`✅ Metafields sincronizzati per prodotto ${p.sku}`);
                }

                await prisma.outputShopify.update({
                    where: { id: p.id },
                    data: { statoCaricamento: 'uploaded' }
                });
                success++;
            } catch (e: any) {
                const errorMsg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
                logger.error(`Errore upload prodotto ${p.id}: ${errorMsg}`);

                await prisma.outputShopify.update({
                    where: { id: p.id },
                    data: { statoCaricamento: 'error', errorMessage: errorMsg }
                });
                errors++;
            }

            const current = success + errors;
            const progress = 40 + Math.round((current / products.length) * 60);
            jobProgressManager.updateProgress(
                jobId,
                progress,
                `Sincronizzati ${success} prodotti... (${errors} errori)`
            );

            await new Promise(r => setTimeout(r, 500));
        }

        jobProgressManager.completeJob(jobId, `Sincronizzazione completata: ${success} caricati, ${errors} errori`);
        return { success, errors, total: products.length };
    }

    static async generateOutputPreview(utenteId: number, page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;

        const [total, products] = await Promise.all([
            prisma.outputShopify.count({ where: { utenteId } }),
            prisma.outputShopify.findMany({
                where: { utenteId },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            })
        ]);

        return {
            products,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }

    static async getSyncProgress(utenteId: number) {
        const [total, pending, uploaded, errors] = await Promise.all([
            prisma.outputShopify.count({ where: { utenteId } }),
            prisma.outputShopify.count({ where: { utenteId, statoCaricamento: 'pending' } }),
            prisma.outputShopify.count({ where: { utenteId, statoCaricamento: 'uploaded' } }),
            prisma.outputShopify.count({ where: { utenteId, statoCaricamento: 'error' } })
        ]);

        return {
            total,
            pending,
            uploaded,
            errors,
            percentage: total > 0 ? Math.round((uploaded / total) * 100) : 0
        };
    }
}
