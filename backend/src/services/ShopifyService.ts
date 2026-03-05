// @ts-nocheck
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { ShopifyExportService } from './ShopifyExportService';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import { jobProgressManager } from './JobProgressService';
import { isSyncCancelled, clearCancelFlag } from '../utils/syncCancelFlag';
import { syncLog, clearSyncLog } from '../utils/syncLogBuffer';

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

    static async syncProducts(utenteId: number, skipExportGeneration: boolean = false): Promise<{ success: number, errors: number, total: number }> {
        logger.info(`🔄 [Utente ${utenteId}] Sincronizzazione Shopify`);

        const config = await this.getConfig(utenteId);
        if (!config.configured) throw new Error('Shopify non configurato');

        const token = await this.getAccessToken(utenteId);
        if (!token) throw new Error('Token Shopify mancante');

        // Creiamo il job subito per mostrare il progresso della preparazione
        const jobId = jobProgressManager.createJob('export', { utenteId });
        jobProgressManager.startJob(jobId, 'Preparazione dati per Shopify...');

        // Genera o aggiorna i record per l'export SOLO se non già fatto (es. dallo Scheduler)
        if (!skipExportGeneration) {
            await ShopifyExportService.generateExport(utenteId, jobId);
        } else {
            logger.info(`⏭️ [Utente ${utenteId}] generateExport saltato (skipExportGeneration=true, già eseguito in fase precedente)`);
        }

        // Conta il totale in coda per il tracking del progresso reale
        // Conta sia nuovi ('pending'/'error') che aggiornamenti prezzo ('price_update')
        const totalPending = await prisma.outputShopify.count({
            where: {
                utenteId,
                statoCaricamento: { in: ['pending', 'error', 'price_update'] }
            }
        });

        if (totalPending === 0) {
            jobProgressManager.completeJob(jobId, 'Nessun prodotto da sincronizzare');
            return { success: 0, errors: 0, total: 0 };
        }

        jobProgressManager.updateProgress(jobId, 0, `Invio di ${totalPending} prodotti a Shopify...`);

        let success = 0;
        let errors = 0;
        let processedTotal = 0;
        const BATCH_SIZE = 250;

        // Pulisci log precedenti e flag di cancellazione
        clearSyncLog(utenteId);
        clearCancelFlag(utenteId);

        syncLog(utenteId, 'info', `🚀 Sync avviata — ${totalPending} prodotti in coda`);

        // Loop a batch: continua finché ci sono prodotti in coda
        while (true) {
            // 🛑 Controlla se l'utente ha richiesto la cancellazione
            if (isSyncCancelled(utenteId)) {
                logger.warn(`🛑 [Utente ${utenteId}] Sync cancellata dall'utente dopo ${processedTotal} prodotti`);
                syncLog(utenteId, 'warning', `🛑 Sync interrotta manualmente — ${success} caricati, ${errors} errori`);
                jobProgressManager.failJob(jobId, `Sync interrotta manualmente dopo ${processedTotal} prodotti (${success} caricati, ${errors} errori)`);
                clearCancelFlag(utenteId);
                return { success, errors, total: processedTotal };
            }

            const products = await prisma.outputShopify.findMany({
                where: {
                    utenteId,
                    statoCaricamento: { in: ['pending', 'error', 'price_update'] }
                },
                take: BATCH_SIZE
            });

            if (products.length === 0) break; // Coda svuotata

            syncLog(utenteId, 'batch', `📦 Batch ${Math.ceil(processedTotal / BATCH_SIZE) + 1} — ${products.length} prodotti`);
            logger.info(`[Shopify] 📦 Batch di ${products.length} prodotti (tot. processati: ${processedTotal}/${totalPending})`);

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
                                let [namespace, key] = fullKey.includes('.') ? fullKey.split('.') : ['custom', fullKey];

                                // 🎯 GESTIONE SPECIALE TARGET SEO (NATIVI SHOPIFY)
                                if (fullKey === 'seo.titolo_ottimizzato') {
                                    // Questo campo è stato già usato come Titolo del prodotto in ShopifyExportService
                                    return;
                                }
                                if (fullKey === 'seo.title_tag') {
                                    // Mappo "seo.title_tag" nei metafield di "global" che Shopify usa per il SEO Titolo
                                    namespace = 'global';
                                    key = 'title_tag';
                                }
                                if (fullKey === 'seo.meta_description') {
                                    // Mappo "seo.meta_description" nei metafield di "global" che Shopify usa per il SEO Description 
                                    namespace = 'global';
                                    key = 'description_tag';
                                }

                                // 🎯 BLACKLIST METAFIELDS NON DEFINITI SU SHOPIFY
                                const ignoredCustomKeys = [
                                    'peso', 'batteria', 'connettivita', 'porte',
                                    'famiglia', 'touch_screen', 'scheda_pdf',
                                    'testo_personalizzato', 'tipologia_display',
                                    'codice_prodotto', 'info_disponibilita'
                                ];
                                if (namespace === 'custom' && ignoredCustomKeys.includes(key)) {
                                    return; // Ignora in modo silenzioso, non trasmettere a Shopify
                                }

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

                    // Determina stato in base al prezzo (robusto per stringhe e float)
                    const parsedPrice = typeof p.variantPrice === 'number'
                        ? p.variantPrice
                        : parseFloat(String(p.variantPrice || '0').replace(',', '.'));

                    const isPriceMissing = !p.variantPrice || parsedPrice <= 0;
                    const status = isPriceMissing ? 'draft' : 'active';
                    const tags = isPriceMissing ? `${p.tags}, Prezzo Mancante` : p.tags;

                    // ⛔ GUARD: Se il prodotto è in stato 'price_update' ma non ha shopifyProductId,
                    // NON creare un nuovo prodotto! Resetta a 'pending' così verrà riprocessato come nuovo.
                    if (p.statoCaricamento === 'price_update' && !p.shopifyProductId) {
                        logger.warn(`⚠️ Prodotto ${p.sku} è in price_update ma non ha shopifyProductId. Reset a pending per riprocessare.`);
                        syncLog(utenteId, 'warning', `⚠️ ${p.sku} — price_update senza ID Shopify, reset a pending`);
                        await prisma.outputShopify.update({
                            where: { id: p.id },
                            data: { statoCaricamento: 'pending', errorMessage: null }
                        });
                        processedTotal++;
                        continue;
                    }

                    // Retry logic per chiamate Shopify
                    let attempts = 0;
                    const maxAttempts = 3;
                    let productSynced = false;

                    let productId: string | null = p.shopifyProductId || null;

                    // Per 'price_update': payload leggero con solo prezzo e qty (no ricreare tutto il prodotto)
                    const isPriceUpdateOnly = p.statoCaricamento === 'price_update';

                    while (attempts < maxAttempts && !productSynced) {
                        try {
                            attempts++;

                            let response;
                            if (isPriceUpdateOnly && productId) {
                                // ✅ Aggiornamento SOLO prezzo e disponibilità (prodotto già su Shopify)
                                logger.info(`💰 Aggiornamento prezzo/qty per ${p.sku} (Shopify ID: ${productId})...`);
                                const priceUpdatePayload = {
                                    product: {
                                        id: productId,
                                        variants: [{
                                            price: typeof p.variantPrice === 'number' ? p.variantPrice.toFixed(2) : parseFloat(String(p.variantPrice).replace(',', '.')).toFixed(2),
                                            inventory_quantity: p.variantInventoryQty
                                        }]
                                    }
                                };
                                response = await axios.put(
                                    `https://${cleanShopUrl}/admin/api/2024-01/products/${productId}.json`,
                                    priceUpdatePayload,
                                    {
                                        headers: { 'X-Shopify-Access-Token': token },
                                        timeout: 60000
                                    }
                                );
                            } else {
                                // ❌ NON inviare metafields nel payload del prodotto - Shopify li ignora!

                                if (productId) {
                                    // ✅ Prodotto già esiste su Shopify: fai UPDATE (PUT) invece di CREATE (POST)
                                    // ⚠️ NON includere 'images' nella PUT: Shopify le AGGIUNGE (non sostituisce)
                                    //    causando duplicati e triplicati ad ogni sincronizzazione!
                                    logger.info(`🔄 Prodotto ${p.sku} già esiste su Shopify (ID: ${productId}), aggiornamento completo (senza immagini)...`);
                                    const updatePayload = {
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
                                                price: typeof p.variantPrice === 'number' ? p.variantPrice.toFixed(2) : parseFloat(String(p.variantPrice).replace(',', '.')).toFixed(2),
                                                inventory_quantity: p.variantInventoryQty
                                            }]
                                            // ⛔ NO images: Shopify le aggiunge invece di sostituirle → duplicati!
                                        }
                                    };
                                    response = await axios.put(
                                        `https://${cleanShopUrl}/admin/api/2024-01/products/${productId}.json`,
                                        updatePayload,
                                        {
                                            headers: { 'X-Shopify-Access-Token': token },
                                            timeout: 60000
                                        }
                                    );
                                } else {
                                    // 🆕 Prodotto nuovo: crea su Shopify (POST) — qui le immagini si inviano solo in creazione
                                    const createPayload = {
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
                                                price: typeof p.variantPrice === 'number' ? p.variantPrice.toFixed(2) : parseFloat(String(p.variantPrice).replace(',', '.')).toFixed(2),
                                                inventory_quantity: p.variantInventoryQty
                                            }],
                                            images: images.length > 0 ? images : undefined
                                        }
                                    };
                                    response = await axios.post(shopifyUrl, createPayload, {
                                        headers: { 'X-Shopify-Access-Token': token },
                                        timeout: 60000
                                    });
                                }
                            }

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

                        // Recupera metafields già esistenti su Shopify per fare PUT invece di POST
                        let existingMetafields: Record<string, { id: string }> = {};
                        try {
                            const existingResp = await axios.get(
                                `https://${cleanShopUrl}/admin/api/2024-01/products/${productId}/metafields.json`,
                                { headers: { 'X-Shopify-Access-Token': token }, timeout: 15000 }
                            );
                            for (const em of existingResp.data?.metafields || []) {
                                existingMetafields[`${em.namespace}.${em.key}`] = { id: em.id };
                            }
                            logger.debug(`📋 Trovati ${Object.keys(existingMetafields).length} metafields esistenti su Shopify`);
                        } catch (e: any) {
                            logger.warn(`⚠️ Impossibile recuperare metafields esistenti per ${p.sku}: ${e.message}`);
                        }

                        for (const metafield of metafields) {
                            let metaAttempts = 0;
                            const maxMetaAttempts = 3;
                            let metaSynced = false;
                            const metaKey = `${metafield.namespace}.${metafield.key}`;
                            const existingMeta = existingMetafields[metaKey];

                            while (metaAttempts < maxMetaAttempts && !metaSynced) {
                                try {
                                    metaAttempts++;

                                    if (existingMeta) {
                                        // ✅ Esiste già → PUT per aggiornare
                                        await axios.put(
                                            `https://${cleanShopUrl}/admin/api/2024-01/metafields/${existingMeta.id}.json`,
                                            { metafield: { id: existingMeta.id, value: String(metafield.value), type: metafield.type } },
                                            { headers: { 'X-Shopify-Access-Token': token }, timeout: 30000 }
                                        );
                                    } else {
                                        // 🆕 Non esiste → POST per creare
                                        await axios.post(
                                            `https://${cleanShopUrl}/admin/api/2024-01/products/${productId}/metafields.json`,
                                            { metafield: { namespace: metafield.namespace, key: metafield.key, value: String(metafield.value), type: metafield.type } },
                                            { headers: { 'X-Shopify-Access-Token': token }, timeout: 30000 }
                                        );
                                    }
                                    logger.debug(`✅ Metafield ${metaKey} sincronizzato`);
                                    metaSynced = true;

                                    // Shopify Leaky Bucket API (2 req/sec). Aspetta >500ms
                                    await new Promise(r => setTimeout(r, 550));

                                } catch (metaError: any) {
                                    if (metaError.response?.status === 429) {
                                        logger.warn(`⚠️ Rate Limit 429 per metafield ${p.sku}. Pausa 5s... (tentativo ${metaAttempts}/3)`);
                                        await new Promise(r => setTimeout(r, 5000));
                                    } else if (metaError.response?.status === 422) {
                                        logger.warn(`⚠️ Metafield ${metaKey} non valido per ${p.sku} (422) — salto`);
                                        metaSynced = true;
                                    } else {
                                        if (metaAttempts >= maxMetaAttempts) {
                                            logger.error(`❌ Errore sync metafield ${metaKey} per ${p.sku}:`, metaError.message);
                                        } else {
                                            await new Promise(r => setTimeout(r, 2000));
                                        }
                                    }
                                }
                            }
                        }
                        logger.info(`✅ Metafields completati per prodotto ${p.sku}`);
                    }

                    await prisma.outputShopify.update({
                        where: { id: p.id },
                        data: {
                            statoCaricamento: 'uploaded',
                            shopifyProductId: productId ? String(productId) : undefined,
                            errorMessage: null
                        }
                    });
                    syncLog(utenteId, 'success', `✅ ${p.title?.substring(0, 50) || p.sku} — caricato (ID: ${productId})`);
                    success++;
                } catch (e: any) {
                    const errorMsg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
                    logger.error(`Errore upload prodotto ${p.id}: ${errorMsg}`);
                    syncLog(utenteId, 'error', `❌ ${p.title?.substring(0, 40) || p.sku} — ${errorMsg.substring(0, 80)}`);

                    await prisma.outputShopify.update({
                        where: { id: p.id },
                        data: { statoCaricamento: 'error', errorMessage: errorMsg }
                    });
                    errors++;
                }

                processedTotal++;
                const progress = 40 + Math.round((processedTotal / totalPending) * 60);
                jobProgressManager.updateProgress(
                    jobId,
                    Math.min(progress, 99),
                    `Sincronizzati ${success} prodotti... (${errors} errori)`
                );

                // Ritardo di sicurezza alla fine di ogni intero prodotto caricato
                await new Promise(r => setTimeout(r, 800));
            }
        } // fine while batch

        jobProgressManager.completeJob(jobId, `Sincronizzazione completata: ${success} caricati, ${errors} errori`);
        syncLog(utenteId, 'success', `🏁 Sync completata — ${success} prodotti caricati, ${errors} errori su ${totalPending} totali`);
        return { success, errors, total: totalPending };
    }


    static async generateOutputPreview(
        utenteId: number,
        page: number = 1,
        limit: number = 20,
        opts: { search?: string; stato?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}
    ) {
        const skip = (page - 1) * limit;
        const { search, stato, sortBy = 'createdAt', sortOrder = 'desc' } = opts;

        // Build where
        const where: any = { utenteId };
        if (stato && stato !== 'all') where.statoCaricamento = stato;
        if (search && search.trim()) {
            const q = search.trim();
            where.OR = [
                { title: { contains: q, mode: 'insensitive' } },
                { handle: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } },
            ];
        }

        // Allowed sort columns (guard against injection)
        const allowedSort = ['createdAt', 'variantPrice', 'variantInventoryQty', 'title', 'statoCaricamento'];
        const orderField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

        const [total, products] = await Promise.all([
            prisma.outputShopify.count({ where }),
            prisma.outputShopify.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [orderField]: sortOrder }
            })
        ]);

        return {
            products,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) }
        };
    }

    static async getSyncProgress(utenteId: number) {
        const [total, pending, uploaded, errors, priceUpdates] = await Promise.all([
            prisma.outputShopify.count({ where: { utenteId } }),
            prisma.outputShopify.count({ where: { utenteId, statoCaricamento: 'pending' } }),
            prisma.outputShopify.count({ where: { utenteId, statoCaricamento: 'uploaded' } }),
            prisma.outputShopify.count({ where: { utenteId, statoCaricamento: 'error' } }),
            prisma.outputShopify.count({ where: { utenteId, statoCaricamento: 'price_update' } })
        ]);

        return {
            total,
            pending,
            uploaded,
            errors,
            priceUpdates,
            percentage: total > 0 ? Math.round((uploaded / total) * 100) : 0
        };
    }

    /**
     * 🔁 Risincronizza un singolo prodotto (per retry manuale dall'UI).
     * Riusa la stessa logica di uploadlo dei prodotti, ma opera su un solo record.
     */
    static async retrySingleProduct(utenteId: number, outputId: number): Promise<{ success: boolean }> {
        const config = await this.getConfig(utenteId);
        if (!config.configured) throw new Error('Shopify non configurato');

        const token = await this.getAccessToken(utenteId);
        if (!token) throw new Error('Token Shopify mancante');

        const p = await prisma.outputShopify.findFirst({ where: { id: outputId, utenteId } });
        if (!p) throw new Error(`Record outputShopify ${outputId} non trovato`);

        const cleanShopUrl = config.shopUrl.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '').split('/')[0];
        const shopifyUrl = `https://${cleanShopUrl}/admin/api/2024-01/products.json`;

        logger.info(`🔁 [Retry] Prodotto ${p.sku} (outputId: ${outputId})`);
        syncLog(utenteId, 'info', `🔁 Retry: ${p.title?.substring(0, 50) || p.sku}`);

        // Prepara metafields
        const metafields: Array<{ namespace: string; key: string; value: string; type: string }> = [];
        if (p.metafieldsJson) {
            try {
                const mData = JSON.parse(p.metafieldsJson);
                const ignoredCustomKeys = ['peso', 'batteria', 'connettivita', 'porte', 'famiglia', 'touch_screen', 'scheda_pdf', 'testo_personalizzato', 'tipologia_display', 'codice_prodotto', 'info_disponibilita'];
                const multiLineKeys = ['descrizione_lunga', 'tabella_specifiche', 'descrizione_breve', 'ean'];
                Object.entries(mData).forEach(([fullKey, value]) => {
                    if (!value || fullKey === 'seo.titolo_ottimizzato') return;
                    let [namespace, key] = fullKey.includes('.') ? fullKey.split('.') : ['custom', fullKey];
                    if (fullKey === 'seo.title_tag') { namespace = 'global'; key = 'title_tag'; }
                    if (fullKey === 'seo.meta_description') { namespace = 'global'; key = 'description_tag'; }
                    if (namespace === 'custom' && ignoredCustomKeys.includes(key)) return;
                    const strVal = String(value);
                    let type = strVal.length > 255 || strVal.includes('\n') || strVal.includes('<') ? 'multi_line_text_field' : 'single_line_text_field';
                    if (multiLineKeys.includes(key)) type = 'multi_line_text_field';
                    metafields.push({ namespace, key, value: strVal, type });
                });
            } catch (_) { }
        }

        // Prepara immagini
        let images: Array<{ src: string }> = [];
        if (p.immaginiUrls) {
            try {
                const urls = JSON.parse(p.immaginiUrls);
                if (Array.isArray(urls)) images = urls.map(url => ({ src: url }));
            } catch (_) { }
        }

        const parsedPrice = typeof p.variantPrice === 'number' ? p.variantPrice : parseFloat(String(p.variantPrice || '0').replace(',', '.'));
        const isPriceMissing = !p.variantPrice || parsedPrice <= 0;
        const status = isPriceMissing ? 'draft' : 'active';
        const productId: string | null = p.shopifyProductId || null;

        try {
            let response: any;
            const priceStr = typeof p.variantPrice === 'number' ? p.variantPrice.toFixed(2) : parseFloat(String(p.variantPrice || '0').replace(',', '.')).toFixed(2);

            if (productId) {
                // Prodotto già su Shopify → aggiornamento completo
                // ⚠️ NON includere 'images' nella PUT: Shopify le AGGIUNGE invece di sostituirle → duplicati!
                response = await axios.put(
                    `https://${cleanShopUrl}/admin/api/2024-01/products/${productId}.json`,
                    { product: { id: productId, title: p.title, body_html: p.bodyHtml, vendor: p.vendor, product_type: p.productType, status, variants: [{ sku: p.sku, barcode: p.barcode, price: priceStr, inventory_quantity: p.variantInventoryQty }] } },
                    { headers: { 'X-Shopify-Access-Token': token }, timeout: 60000 }
                );
            } else {
                // Nuovo prodotto → crea (immagini inviate solo alla creazione)
                response = await axios.post(shopifyUrl,
                    { product: { title: p.title, body_html: p.bodyHtml, vendor: p.vendor, product_type: p.productType, status, tags: p.tags, variants: [{ sku: p.sku, barcode: p.barcode, price: priceStr, inventory_quantity: p.variantInventoryQty }], images: images.length > 0 ? images : undefined } },
                    { headers: { 'X-Shopify-Access-Token': token }, timeout: 60000 }
                );
            }

            const newProductId = response.data?.product?.id;

            // Sincronizza metafields (GET esistenti → PUT/POST)
            if (newProductId && metafields.length > 0) {
                let existingMetafields: Record<string, { id: string }> = {};
                try {
                    const existingResp = await axios.get(`https://${cleanShopUrl}/admin/api/2024-01/products/${newProductId}/metafields.json`, { headers: { 'X-Shopify-Access-Token': token }, timeout: 15000 });
                    for (const em of existingResp.data?.metafields || []) existingMetafields[`${em.namespace}.${em.key}`] = { id: em.id };
                } catch (_) { }

                for (const mf of metafields) {
                    try {
                        const existing = existingMetafields[`${mf.namespace}.${mf.key}`];
                        if (existing) {
                            await axios.put(`https://${cleanShopUrl}/admin/api/2024-01/metafields/${existing.id}.json`, { metafield: { id: existing.id, value: mf.value, type: mf.type } }, { headers: { 'X-Shopify-Access-Token': token }, timeout: 30000 });
                        } else {
                            await axios.post(`https://${cleanShopUrl}/admin/api/2024-01/products/${newProductId}/metafields.json`, { metafield: mf }, { headers: { 'X-Shopify-Access-Token': token }, timeout: 30000 });
                        }
                        await new Promise(r => setTimeout(r, 600)); // rate limit
                    } catch (mfe: any) {
                        if (mfe.response?.status !== 422) logger.warn(`⚠️ Metafield ${mf.key} retry fallito: ${mfe.message}`);
                    }
                }
            }

            await prisma.outputShopify.update({
                where: { id: outputId },
                data: { statoCaricamento: 'uploaded', shopifyProductId: newProductId ? String(newProductId) : productId, errorMessage: null }
            });

            syncLog(utenteId, 'success', `✅ Retry riuscito: ${p.title?.substring(0, 50) || p.sku}`);
            logger.info(`✅ [Retry] Prodotto ${p.sku} risincronizzato con successo`);
            return { success: true };

        } catch (e: any) {
            const errorMsg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
            await prisma.outputShopify.update({
                where: { id: outputId },
                data: { statoCaricamento: 'error', errorMessage: errorMsg }
            });
            syncLog(utenteId, 'error', `❌ Retry fallito: ${p.sku} — ${errorMsg.substring(0, 80)}`);
            logger.error(`❌ [Retry] Prodotto ${p.sku}: ${errorMsg}`);
            return { success: false };
        }
    }
}
