import prisma from '../config/database';
import { logger } from '../utils/logger';
import { ShopifyExportService } from './ShopifyExportService';
import CryptoJS from 'crypto-js';
import axios from 'axios';

/**
 * Servizio per la sincronizzazione con Shopify
 */
export class ShopifyService {

    /**
     * Ottiene la configurazione Shopify
     */
    static async getConfig(): Promise<{ shopUrl: string; configured: boolean; placeholderImageUrl: string }> {
        const shopUrlConfig = await prisma.configurazioneSistema.findUnique({
            where: { chiave: 'shopify_shop_url' }
        });

        const accessTokenConfig = await prisma.configurazioneSistema.findUnique({
            where: { chiave: 'shopify_access_token' }
        });

        const placeholderConfig = await prisma.configurazioneSistema.findUnique({
            where: { chiave: 'shopify_placeholder_image' }
        });

        return {
            shopUrl: shopUrlConfig?.valore || '',
            configured: !!(shopUrlConfig?.valore && accessTokenConfig?.valore),
            placeholderImageUrl: placeholderConfig?.valore || ''
        };
    }

    /**
     * Salva la configurazione Shopify
     */
    static async saveConfig(shopUrl: string, accessToken: string): Promise<void> {
        const encryptionKey = process.env.ENCRYPTION_KEY || '32-char-secret-key-for-aes-256';
        const encryptedToken = CryptoJS.AES.encrypt(accessToken, encryptionKey).toString();

        await Promise.all([
            prisma.configurazioneSistema.upsert({
                where: { chiave: 'shopify_shop_url' },
                create: {
                    chiave: 'shopify_shop_url',
                    valore: shopUrl,
                    tipo: 'string',
                    descrizione: 'URL dello shop Shopify'
                },
                update: { valore: shopUrl }
            }),
            prisma.configurazioneSistema.upsert({
                where: { chiave: 'shopify_access_token' },
                create: {
                    chiave: 'shopify_access_token',
                    valore: encryptedToken,
                    tipo: 'string',
                    descrizione: 'Access Token criptato per Shopify'
                },
                update: { valore: encryptedToken }
            })
        ]);

        logger.info('✅ Configurazione Shopify salvata');
    }

    /**
     * Prepara i prodotti per l'export verso Shopify
     */
    static async prepareExport(): Promise<number> {
        logger.info('📦 Inizio preparazione export Shopify');

        try {
            // Usa il nuovo servizio ShopifyExportService per generare i dati
            const products = await ShopifyExportService.generateShopifyExport();

            // Recupera gli ID dei MasterFile per l'Handle univoco
            const masterFiles = await prisma.masterFile.findMany({
                where: { eanGtin: { in: products.map(p => p.ean) } },
                select: { id: true, eanGtin: true }
            });
            const eanToIdMap = new Map(masterFiles.map(mf => [mf.eanGtin, mf.id]));

            // Recupera URL immagine placeholder dalla configurazione
            const placeholderConfig = await prisma.configurazioneSistema.findUnique({
                where: { chiave: 'shopify_placeholder_image' }
            });
            // Default placeholder: usa un servizio gratuito se non configurato
            const placeholderUrl = placeholderConfig?.valore ||
                'https://placehold.co/800x800/e2e8f0/64748b?text=Immagine+non+disponibile';

            // Mappa i dati nel formato CSV di Shopify con TUTTI i metafield
            // IMPORTANTE: Usiamo EAN come Handle per permettere aggiornamento prodotti esistenti
            // NOTA: Per più immagini, Shopify richiede righe separate con solo Handle, Image Src, Image Position

            const csvRows: any[] = [];

            for (const p of products) {
                // Limita a massimo 10 immagini per prodotto (evita CSV troppo grandi)
                const maxImages = 10;
                let images = (p.immagini || []).slice(0, maxImages);

                // Se non ci sono immagini, usa il placeholder
                if (images.length === 0) {
                    images = [placeholderUrl];
                    logger.info(`🖼️ Usando placeholder per prodotto: ${p.ean}`);
                }

                // Riga principale del prodotto (con prima immagine o senza)
                const mainRow: any = {
                    // === CAMPI BASE ===
                    // Handle = EAN per compatibilità con prodotti già caricati su Shopify
                    'Handle': p.ean,
                    'Title': p.nome,
                    'Body (HTML)': p.descrizioneLunga,
                    'Vendor': p.marca,
                    'Type': p.famiglia,
                    'Tags': p.tags,
                    'Published': 'TRUE',
                    'Option1 Name': 'Title',
                    'Option1 Value': 'Default Title',
                    'Variant SKU': p.ean,
                    'Variant Barcode': p.ean,
                    'Variant Grams': '1000',
                    'Variant Inventory Tracker': 'shopify',
                    'Variant Inventory Qty': p.quantita,
                    'Variant Inventory Policy': 'deny',
                    'Variant Fulfillment Service': 'manual',
                    'Variant Price': p.prezzo,
                    'Image Src': images[0] || '',
                    'Image Position': images.length > 0 ? '1' : '',

                    // === METAFIELD: Famiglia e Display ===
                    'Metafield: custom.famiglia [single_line_text_field]': p.famiglia || '',
                    'Metafield: custom.tipologia_display [single_line_text_field]': p.tipologiaDisplay || '',
                    'Metafield: custom.touch_screen [single_line_text_field]': p.touchScreen || '',
                    'Metafield: custom.rapporto_aspetto [single_line_text_field]': p.rapportoAspetto || '',
                    'Metafield: custom.risoluzione_monitor [single_line_text_field]': p['risoluzione Monitor'] || '',
                    'Metafield: custom.dimensione_monitor [single_line_text_field]': p.dimensioneMonitor || '',
                    'Metafield: custom.dimensione_schermo [single_line_text_field]': p.dimensioneSchermo || '',
                    'Metafield: custom.display [single_line_text_field]': (p as any).display || '',

                    // === METAFIELD: PC e Hardware ===
                    'Metafield: custom.tipo_pc [single_line_text_field]': p.tipoPC || '',
                    'Metafield: custom.capacita_ssd [single_line_text_field]': p.capacitaSSD || '',
                    'Metafield: custom.scheda_video [single_line_text_field]': p.schedaVideo || '',
                    'Metafield: custom.sistema_operativo [single_line_text_field]': p.sistemaOperativo || '',
                    'Metafield: custom.ram [single_line_text_field]': p.ram || '',
                    'Metafield: custom.processore_brand [single_line_text_field]': p.processoreBrand || '',
                    'Metafield: custom.cpu [single_line_text_field]': (p as any).cpu || '',

                    // === METAFIELD: Contenuti e Testi ===
                    'Metafield: custom.tabella_specifiche [multi_line_text_field]': p.tabellaSpecifiche || '',
                    'Metafield: custom.ean [multi_line_text_field]': p.ean || '',
                    'Metafield: custom.testo_personalizzato [single_line_text_field]': p.testoPersonalizzato || '',
                    'Metafield: custom.descrizione_breve [multi_line_text_field]': p.descrizioneBrave || '',
                    'Metafield: custom.descrizione_lunga [multi_line_text_field]': p.descrizioneLunga || '',
                    'Metafield: custom.marca [single_line_text_field]': p.marca || '',
                    'Metafield: custom.codice_prodotto [single_line_text_field]': p.productCode || '',

                    // === METAFIELD: File ===
                    'Metafield: custom.scheda_pdf [url]': p.schedaPDF || ''
                };

                csvRows.push(mainRow);

                // Righe aggiuntive per immagini extra (solo Handle, Image Src, Image Position)
                for (let i = 1; i < images.length; i++) {
                    csvRows.push({
                        'Handle': p.ean,
                        'Image Src': images[i],
                        'Image Position': String(i + 1)
                    });
                }
            }

            // Genera il file CSV
            const Papa = require('papaparse');
            const fs = require('fs');
            const path = require('path');

            const csv = Papa.unparse(csvRows, {
                quotes: true, // Force quotes
                delimiter: ",",
            });

            const filePath = path.join(__dirname, '../../shopify_export.csv');
            fs.writeFileSync(filePath, csv, 'utf-8');
            logger.info(`✅ File CSV generato in: ${filePath}`);

            // Salva i prodotti nella tabella OutputShopify
            logger.info('💾 Salvataggio prodotti in OutputShopify...');

            // Nota: masterFiles e eanToIdMap già dichiarati sopra
            let savedCount = 0;

            for (const p of products) {
                const masterFileId = eanToIdMap.get(p.ean);
                if (!masterFileId) continue;

                // Usa placeholder se non ci sono immagini
                const productImages = (p.immagini && p.immagini.length > 0)
                    ? p.immagini
                    : [placeholderUrl];

                // Handle = EAN per compatibilità con prodotti già su Shopify

                // Metafields COMPLETI con nomi corretti allineati a Shopify
                const metafields = {
                    // Display
                    famiglia: p.famiglia || '',
                    tipologia_display: p.tipologiaDisplay || '',
                    touch_screen: p.touchScreen || '',
                    rapporto_aspetto: p.rapportoAspetto || '',
                    risoluzione_monitor: p['risoluzione Monitor'] || '',
                    dimensione_monitor: p.dimensioneMonitor || '',
                    dimensione_schermo: p.dimensioneSchermo || '',
                    display: (p as any).display || '',
                    // Hardware
                    tipo_pc: p.tipoPC || '',
                    capacita_ssd: p.capacitaSSD || '',
                    scheda_video: p.schedaVideo || '',
                    sistema_operativo: p.sistemaOperativo || '',
                    ram: p.ram || '',
                    processore_brand: p.processoreBrand || '',
                    cpu: (p as any).cpu || '',
                    // Contenuti
                    tabella_specifiche: p.tabellaSpecifiche || '',
                    ean: p.ean || '',
                    testo_personalizzato: p.testoPersonalizzato || '',
                    descrizione_breve: p.descrizioneBrave || '',
                    descrizione_lunga: p.descrizioneLunga || '', // Aggiunto descrizione lunga!
                    marca: p.marca || '',
                    codice_prodotto: p.productCode || '',
                    // File
                    scheda_pdf: p.schedaPDF || ''
                };

                const specifiche = {
                    famiglia: p.famiglia,
                    touchScreen: p.touchScreen,
                    rapportoAspetto: p.rapportoAspetto,
                    dimensioneMonitor: p.dimensioneMonitor,
                    dimensioneSchermo: p.dimensioneSchermo
                };

                await prisma.outputShopify.upsert({
                    where: { masterFileId: masterFileId },
                    create: {
                        masterFileId: masterFileId,
                        handle: p.ean, // Handle = EAN per compatibilità Shopify
                        title: p.nome,
                        bodyHtml: p.descrizioneLunga,
                        vendor: p.marca,
                        productType: p.famiglia,
                        tags: p.tags,
                        variantPrice: p.prezzo,
                        variantInventoryQty: p.quantita,
                        immaginiUrls: JSON.stringify(productImages),
                        descrizioneBreve: p.descrizioneBrave,
                        specificheJson: JSON.stringify(specifiche),
                        metafieldsJson: JSON.stringify(metafields),
                        statoCaricamento: 'pending'
                    },
                    update: {
                        handle: p.ean, // Handle = EAN per compatibilità Shopify
                        title: p.nome,
                        bodyHtml: p.descrizioneLunga,
                        vendor: p.marca,
                        productType: p.famiglia,
                        tags: p.tags,
                        variantPrice: p.prezzo,
                        variantInventoryQty: p.quantita,
                        immaginiUrls: JSON.stringify(productImages),
                        descrizioneBreve: p.descrizioneBrave,
                        specificheJson: JSON.stringify(specifiche),
                        metafieldsJson: JSON.stringify(metafields),
                        statoCaricamento: 'pending', // Reset to pending on update
                        errorMessage: null
                    }
                });
                savedCount++;
            }

            logger.info(`✅ Salvati ${savedCount} prodotti in OutputShopify`);
            return savedCount;

        } catch (error: any) {
            logger.error('❌ Errore durante preparazione export:', error.message);
            throw error;
        }
    }

    /**
     * Sincronizza i prodotti con Shopify
     */
    static async syncToShopify(): Promise<{
        total: number;
        synced: number;
        errors: number;
    }> {
        logger.info('🔄 Inizio sincronizzazione Shopify');

        const { shopUrl, configured } = await this.getConfig();
        if (!configured) {
            throw new Error('Shopify non configurato');
        }

        // Decrypt token
        const tokenConfig = await prisma.configurazioneSistema.findUnique({
            where: { chiave: 'shopify_access_token' }
        });

        if (!tokenConfig?.valore) {
            throw new Error('Token Shopify mancante');
        }

        const encryptionKey = process.env.ENCRYPTION_KEY || '32-char-secret-key-for-aes-256';
        const bytes = CryptoJS.AES.decrypt(tokenConfig.valore, encryptionKey);
        const accessToken = bytes.toString(CryptoJS.enc.Utf8);

        // Recupera prodotti pending o in errore (opzionale: riprovare errori?)
        // Per ora prendiamo solo pending per non bloccare il flusso, ma l'utente potrebbe voler riprovare gli errori
        const pendingProducts = await prisma.outputShopify.findMany({
            where: {
                OR: [
                    { statoCaricamento: 'pending' },
                    { statoCaricamento: 'error' } // Riprova anche gli errori precedenti
                ]
            }
        });

        logger.info(`Found ${pendingProducts.length} pending/error products to sync`);

        let synced = 0;
        let errors = 0;

        // Process in smaller chunks to be safer immediately
        // Shopify Leaky Bucket: 40 requests bucket, leaks 2 req/s.
        // Chunk 2 every 1s = 2 req/s. This matches the leak rate perfectly.
        const CHUNK_SIZE = 2; // Riduciamo a 2 per sicurezza
        const DELAY_MS = 1100; // Poco più di 1 secondo per stare sotto il rate limit

        for (let i = 0; i < pendingProducts.length; i += CHUNK_SIZE) {
            const chunk = pendingProducts.slice(i, i + CHUNK_SIZE);
            const batchStart = Date.now();

            await Promise.all(chunk.map(async (product) => {
                try {
                    await this.sendProductToShopify(product, shopUrl, accessToken);

                    await prisma.outputShopify.update({
                        where: { id: product.id },
                        data: {
                            statoCaricamento: 'uploaded',
                            errorMessage: null,
                            updatedAt: new Date()
                        }
                    });
                    synced++;
                } catch (error: any) {
                    let errorMsg = error.message;

                    if (error.response?.data?.errors) {
                        // Formatta meglio gli errori di validazione Shopify (422)
                        errorMsg = `Shopify Validation: ${JSON.stringify(error.response.data.errors)}`;
                    } else if (error.response?.status === 429) {
                        errorMsg = 'Rate Limit Exceeded (Max Retries)';
                    }

                    logger.error(`Error syncing ${product.handle}: ${errorMsg}`);

                    await prisma.outputShopify.update({
                        where: { id: product.id },
                        data: {
                            statoCaricamento: 'error',
                            errorMessage: errorMsg,
                            updatedAt: new Date()
                        }
                    });
                    errors++;
                }
            }));

            // Rate limiting pause
            if (i + CHUNK_SIZE < pendingProducts.length) {
                const elapsed = Date.now() - batchStart;
                const wait = Math.max(0, DELAY_MS - elapsed);
                if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
            }
        }

        return {
            total: pendingProducts.length,
            synced,
            errors
        };
    }

    /**
     * Helper per eseguire richieste con Retry su 429
     */
    private static async makeRequest(client: any, method: string, url: string, data?: any, retries = 5): Promise<any> {
        try {
            return await client.request({ method, url, data });
        } catch (error: any) {
            if (retries > 0 && error.response?.status === 429) {
                // Leggi header Retry-After, oppure default a 2s * tentativo
                const headerRetry = error.response.headers['retry-after'];
                const waitTime = headerRetry ? parseFloat(headerRetry) * 1000 : 2000;

                logger.warn(`⚠️ Rate limit hit. Waiting ${waitTime}ms... (Retries left: ${retries})`);
                await new Promise(r => setTimeout(r, waitTime + 500)); // Buffer extra

                return this.makeRequest(client, method, url, data, retries - 1);
            }
            throw error;
        }
    }

    /**
     * Invia un singolo prodotto a Shopify
     */
    private static async sendProductToShopify(product: any, shopUrl: string, accessToken: string) {
        // Rimuovi https://, http:// e trailing slash dall'URL
        const cleanShopUrl = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

        const client = axios.create({
            baseURL: `https://${cleanShopUrl}/admin/api/2024-01`,
            headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json'
            }
        });

        let existingProduct = null;
        let shopifyId = product.shopifyProductId;

        // 1. Se abbiamo già un ID Shopify salvato, verifichiamo se esiste ancora
        if (shopifyId) {
            try {
                const res = await this.makeRequest(client, 'get', `/products/${shopifyId}.json`);
                existingProduct = res.data.product;
                logger.info(`✅ Prodotto trovato tramite ID: ${shopifyId}`);
            } catch (error: any) {
                if (error.response?.status === 404) {
                    logger.warn(`⚠️ ID Shopify ${shopifyId} non trovato. Provo ricerca per Handle...`);
                    shopifyId = null; // Reset per cercare via handle
                } else {
                    throw error;
                }
            }
        }

        // 2. Se non trovato per ID, cerca per Handle
        if (!existingProduct) {
            // Encode handle per sicurezza (es. spazi o caratteri speciali)
            const encodedHandle = encodeURIComponent(product.handle);
            const searchRes = await this.makeRequest(client, 'get', `/products.json?handle=${encodedHandle}`);
            if (searchRes.data.products.length > 0) {
                existingProduct = searchRes.data.products[0];
                shopifyId = existingProduct.id;
                logger.info(`✅ Prodotto trovato tramite Handle: ${product.handle} -> ID: ${shopifyId}`);

                // Aggiorniamo subito l'ID nel DB per il futuro
                await prisma.outputShopify.update({
                    where: { id: product.id },
                    data: { shopifyProductId: String(shopifyId) }
                });
            }
        }

        const productData: any = {
            title: product.title,
            body_html: product.bodyHtml,
            vendor: product.vendor,
            product_type: product.productType,
            tags: product.tags,
            handle: product.handle, // Assicuriamo che l'handle sia settato
            variants: [
                {
                    price: product.variantPrice,
                    sku: product.handle, // Use handle as SKU
                    inventory_quantity: product.variantInventoryQty,
                    inventory_management: 'shopify'
                }
            ]
        };

        // Images Logic - Sync Smart
        // Se siamo in Update, controlliamo se serve aggiornare le immagini
        if (existingProduct) {
            const dbImages = product.immaginiUrls ? JSON.parse(product.immaginiUrls) : [];
            const shopifyImages = existingProduct.images || [];

            // Heuristic: Aggiorna immagini solo se il numero è diverso.
            if (dbImages.length !== shopifyImages.length) {
                logger.info(`📸 Rilevata discrepanza immagini per ${product.handle}. Risincronizzazione immagini...`);

                // 1. Rimuovi tutte le immagini esistenti su Shopify
                try {
                    await Promise.all(shopifyImages.map((img: any) =>
                        // Non usiamo makeRequest qui per parallellismo veloce, se fallisce amen
                        client.delete(`/products/${existingProduct.id}/images/${img.id}.json`)
                    ));
                    logger.info(`🗑️ Eliminate vecchie immagini per ${product.handle}`);
                } catch (e: any) {
                    logger.warn(`⚠️ Errore durante pulizia immagini per ${product.handle}: ${e.message}`);
                }

                // 2. Aggiungi le nuove immagini al payload
                if (dbImages.length > 0) {
                    productData.images = dbImages.map((src: string) => ({ src }));
                }
            }
        } else {
            // Create New Product - Always send images
            if (product.immaginiUrls) {
                try {
                    const images = JSON.parse(product.immaginiUrls);
                    if (Array.isArray(images) && images.length > 0) {
                        productData.images = images.map((src: string) => ({ src }));
                    }
                } catch (e) {
                    logger.warn(`Failed to parse images for ${product.handle}`);
                }
            }
        }

        // Metafields
        if (product.metafieldsJson) {
            try {
                const mf = JSON.parse(product.metafieldsJson);
                const metafieldsPayload: any[] = [];
                const addMetafield = (key: string, value: string, type: string = 'single_line_text_field') => {
                    if (value && value.trim()) {
                        metafieldsPayload.push({ namespace: 'custom', key, value, type });
                    }
                };

                // Mapping Metafields (stesso logic precedente...)
                addMetafield('famiglia', mf.famiglia);
                addMetafield('tipologia_display', mf.tipologia_display);
                addMetafield('touch_screen', mf.touch_screen);
                addMetafield('rapporto_aspetto', mf.rapporto_aspetto);
                addMetafield('risoluzione_monitor', mf.risoluzione_monitor);
                addMetafield('dimensione_monitor', mf.dimensione_monitor);
                addMetafield('dimensione_schermo', mf.dimensione_schermo);
                addMetafield('display', mf.display);
                addMetafield('tipo_pc', mf.tipo_pc);
                addMetafield('capacita_ssd', mf.capacita_ssd);
                addMetafield('scheda_video', mf.scheda_video);
                addMetafield('sistema_operativo', mf.sistema_operativo);
                addMetafield('ram', mf.ram);
                addMetafield('processore_brand', mf.processore_brand);
                addMetafield('cpu', mf.cpu);
                addMetafield('tabella_specifiche', mf.tabella_specifiche || mf.tabelle_specifiche, 'multi_line_text_field');
                addMetafield('ean', mf.ean, 'multi_line_text_field');
                addMetafield('testo_personalizzato', mf.testo_personalizzato);
                addMetafield('descrizione_breve', mf.descrizione_breve, 'multi_line_text_field');
                addMetafield('descrizione_lunga', mf.descrizione_lunga, 'multi_line_text_field');
                addMetafield('marca', mf.marca);
                addMetafield('codice_prodotto', mf.codice_prodotto);
                if (mf.scheda_pdf && mf.scheda_pdf.trim()) {
                    metafieldsPayload.push({ namespace: 'custom', key: 'scheda_pdf', value: mf.scheda_pdf, type: 'url' });
                }

                if (metafieldsPayload.length > 0) {
                    productData.metafields = metafieldsPayload;
                }
            } catch (e) {
                logger.warn(`Failed to parse metafields for ${product.handle}`);
            }
        }

        if (existingProduct) {
            // Update
            const variantId = existingProduct.variants[0]?.id;
            if (variantId) {
                productData.variants[0].id = variantId;
            }
            // Non inviare images nell'update a meno che non siano state resettate sopra
            if (!productData.images) {
                delete productData.images;
            }

            await this.makeRequest(client, 'put', `/products/${existingProduct.id}.json`, { product: productData });
            logger.info(`Updated Shopify product: ${product.handle}`);
        } else {
            // Create
            const createRes = await this.makeRequest(client, 'post', '/products.json', { product: productData });
            const newProduct = createRes.data.product;

            if (newProduct && newProduct.id) {
                await prisma.outputShopify.update({
                    where: { id: product.id },
                    data: { shopifyProductId: String(newProduct.id) }
                });
                logger.info(`Created Shopify product: ${product.handle} (ID: ${newProduct.id})`);
            }
        }
    }

    /**
     * Genera anteprima output
     */
    static async generateOutputPreview(page: number = 1, limit: number = 20): Promise<{
        data: any[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }> {
        // 1. Controlla se ci sono dati in OutputShopify
        const total = await prisma.outputShopify.count();

        if (total > 0) {
            const products = await prisma.outputShopify.findMany({
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { id: 'asc' }
            });

            const mappedData = products.map(p => ({
                id: p.handle, // Use handle or ID
                handle: p.handle,
                title: p.title,
                tags: p.tags,
                variantPrice: p.variantPrice,
                variantInventoryQty: p.variantInventoryQty,
                statoCaricamento: p.statoCaricamento,
                bodyHtml: p.bodyHtml,
                immaginiUrls: p.immaginiUrls ? JSON.parse(p.immaginiUrls) : null,
                specificheJson: p.specificheJson ? 'true' : null
            }));

            return {
                data: mappedData,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        }

        // 2. Fallback: Genera al volo (se DB vuoto)
        const products = await ShopifyExportService.generateShopifyExport();

        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedProducts = products.slice(startIndex, endIndex);

        // Mappa i prodotti nel formato atteso dal frontend
        const mappedData = paginatedProducts.map(p => ({
            id: p.ean,
            handle: p.ean, // Usiamo EAN come handle per ora
            title: p.nome,
            tags: p.tags,
            variantPrice: p.prezzo,
            variantInventoryQty: p.quantita,
            statoCaricamento: 'ready', // Stato fittizio per anteprima
            bodyHtml: p.descrizioneLunga,
            immaginiUrls: p.immagini && p.immagini.length > 0 ? p.immagini : null,
            specificheJson: p.tabellaSpecifiche ? 'true' : null // Segnaliamo presenza specifiche
        }));

        return {
            data: mappedData,
            pagination: {
                page,
                limit,
                total: products.length,
                totalPages: Math.ceil(products.length / limit)
            }
        };
    }

    /**
     * Ottiene progresso sincronizzazione
     */
    /**
     * Ottiene progresso sincronizzazione
     */
    static async getSyncProgress(): Promise<{
        total: number;
        uploaded: number;
        pending: number;
        errors: number;
        percentage: number;
        isRunning: boolean;
        estimatedMinutesRemaining: number;
    }> {
        const total = await prisma.outputShopify.count();
        const uploaded = await prisma.outputShopify.count({ where: { statoCaricamento: 'uploaded' } });
        const errors = await prisma.outputShopify.count({ where: { statoCaricamento: 'error' } });
        const pending = await prisma.outputShopify.count({ where: { statoCaricamento: 'pending' } });

        const percentage = total > 0 ? Math.round(((uploaded + errors) / total) * 100) : 0;

        // Stima: 4 prodotti ogni ~2.5 secondi (batch) = ~0.65s a prodotto
        const estimatedMinutesRemaining = Math.ceil((pending * 0.65) / 60);

        return {
            total,
            uploaded,
            pending,
            errors,
            percentage,
            isRunning: pending > 0, // Se ci sono pending, assumiamo sia in corso (o da fare)
            estimatedMinutesRemaining
        };
    }
}
