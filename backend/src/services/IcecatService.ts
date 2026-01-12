import prisma from '../config/database';
import { logger } from '../utils/logger';
import axios from 'axios';
import xml2js from 'xml2js';
import CryptoJS from 'crypto-js';

/**
 * Servizio per l'arricchimento dati tramite Icecat API
 * 
 * Icecat fornisce:
 * - Descrizioni brevi e lunghe
 * - Specifiche tecniche dettagliate
 * - Immagini prodotto (gallery + high-res)
 * - Bullet points
 * - Documenti (PDF, manuali)
 */
export class IcecatService {

    private static readonly API_BASE_URL = 'https://data.icecat.biz/xml_s3/xml_server3.cgi';
    private static readonly DEFAULT_LANGUAGE = 'it';
    private static readonly REQUEST_TIMEOUT = 10000; // 10 secondi
    private static readonly BATCH_SIZE = 10; // Processa 10 prodotti alla volta
    private static readonly DELAY_BETWEEN_REQUESTS = 500; // 500ms tra richieste

    /**
     * Ottiene le credenziali Icecat dal database
     */
    private static async getCredentials(): Promise<{ username: string; password: string }> {
        const [usernameConfig, passwordConfig] = await Promise.all([
            prisma.configurazioneSistema.findUnique({ where: { chiave: 'icecat_username' } }),
            prisma.configurazioneSistema.findUnique({ where: { chiave: 'icecat_password' } })
        ]);

        const username = usernameConfig?.valore || '';

        // Decrypt password
        let password = '';
        if (passwordConfig?.valore) {
            const encryptionKey = process.env.ENCRYPTION_KEY || '32-char-secret-key-for-aes-256';
            const decrypted = CryptoJS.AES.decrypt(passwordConfig.valore, encryptionKey);
            password = decrypted.toString(CryptoJS.enc.Utf8);
        }

        if (!username || !password) {
            throw new Error('Credenziali Icecat non configurate');
        }

        return { username, password };
    }

    /**
     * Salva le credenziali Icecat nel database
     */
    static async saveConfig(username: string, password: string): Promise<void> {
        const encryptionKey = process.env.ENCRYPTION_KEY || '32-char-secret-key-for-aes-256';
        const encryptedPassword = CryptoJS.AES.encrypt(password, encryptionKey).toString();

        await Promise.all([
            prisma.configurazioneSistema.upsert({
                where: { chiave: 'icecat_username' },
                create: {
                    chiave: 'icecat_username',
                    valore: username,
                    tipo: 'string',
                    descrizione: 'Username per API Icecat'
                },
                update: { valore: username }
            }),
            prisma.configurazioneSistema.upsert({
                where: { chiave: 'icecat_password' },
                create: {
                    chiave: 'icecat_password',
                    valore: encryptedPassword,
                    tipo: 'string',
                    descrizione: 'Password criptata per API Icecat'
                },
                update: { valore: encryptedPassword }
            })
        ]);

        logger.info('✅ Credenziali Icecat salvate');
    }

    /**
     * Ottiene la configurazione Icecat
     */
    static async getConfig(): Promise<{ username: string; configured: boolean }> {
        const usernameConfig = await prisma.configurazioneSistema.findUnique({
            where: { chiave: 'icecat_username' }
        });

        const passwordConfig = await prisma.configurazioneSistema.findUnique({
            where: { chiave: 'icecat_password' }
        });

        return {
            username: usernameConfig?.valore || '',
            configured: !!(usernameConfig?.valore && passwordConfig?.valore)
        };
    }

    /**
     * Interroga l'API Icecat.
     * Priorità 1: EAN
     * Priorità 2: Product Code (MPN) + Brand
     */
    private static async fetchProductData(
        ean: string,
        credentials: { username: string; password: string },
        mpn?: string,
        brand?: string
    ): Promise<any> {
        let url = `${this.API_BASE_URL}?ean_upc=${ean}&lang=${this.DEFAULT_LANGUAGE}&output_product_xml=1`;

        const makeRequest = async (requestUrl: string) => {
            try {
                const response = await axios.get(requestUrl, {
                    auth: credentials,
                    timeout: this.REQUEST_TIMEOUT,
                    validateStatus: (status) => status < 500,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });

                if (response.status === 401) throw new Error('Autenticazione Icecat fallita');
                if (response.status === 404) return null;

                const parser = new xml2js.Parser({ explicitArray: false });
                const result = await parser.parseStringPromise(response.data);
                const icecatInterface = result['ICECAT-interface'];
                const product = icecatInterface?.Product;

                if (!product || product['@_ErrorMessage']) {
                    if (product?.['@_ErrorMessage']) {
                        // Non loggare come warning se è solo "Product not found", è normale flow
                        if (!product['@_ErrorMessage'].includes('not found')) {
                            logger.warn(`Icecat error: ${product['@_ErrorMessage']}`);
                        }
                    }
                    return null;
                }
                return product;
            } catch (error: any) {
                if (error.code === 'ECONNABORTED' || error.name === 'AbortError') {
                    logger.warn(`Timeout richiesta Icecat`);
                } else {
                    logger.error(`Errore richiesta Icecat: ${error.message}`);
                }
                return null;
            }
        };

        // 1. Tenta con EAN
        let product = await makeRequest(url);
        if (product) {
            logger.debug(`✅ Trovato su Icecat con EAN ${ean}`);
            return product;
        }

        // 2. Tenta con MPN + Brand se disponibili
        if (mpn && brand) {
            // Pulisci brand e mpn
            const cleanBrand = brand.trim();
            const cleanMpn = mpn.trim();

            if (cleanBrand && cleanMpn) {
                logger.debug(`⚠️ EAN ${ean} non trovato, tento con MPN: ${cleanMpn} Brand: ${cleanBrand}`);
                // URL per ricerca Product Code: prod_id=<MPN>&vendor=<BRAND>
                url = `${this.API_BASE_URL}?prod_id=${encodeURIComponent(cleanMpn)}&vendor=${encodeURIComponent(cleanBrand)}&lang=${this.DEFAULT_LANGUAGE}&output_product_xml=1`;

                product = await makeRequest(url);
                if (product) {
                    logger.info(`✅ Trovato su Icecat con MPN ${cleanMpn} (Prodotto recuperato!)`);
                    return product;
                }
            }
        }

        return null; // Nulla da fare
    }

    /**
     * Estrae e formatta i dati dal prodotto Icecat
     */
    private static extractProductData(product: any, ean: string): any {
        const attrs = product.$ || product || {};

        // Descrizioni - gestisci sia stringhe che oggetti
        let descrizioneBrave = null;
        let descrizioneLunga = null;

        // Prova vari formati per la descrizione breve
        if (product.SummaryDescription?.ShortSummaryDescription) {
            const short = product.SummaryDescription.ShortSummaryDescription;
            descrizioneBrave = typeof short === 'string' ? short : (short._ || short.$?.Value || null);
        } else if (attrs.ShortDesc) {
            descrizioneBrave = typeof attrs.ShortDesc === 'string' ? attrs.ShortDesc : (attrs.ShortDesc._ || null);
        }

        // Prova vari formati per la descrizione lunga
        if (product.SummaryDescription?.LongSummaryDescription) {
            const long = product.SummaryDescription.LongSummaryDescription;
            descrizioneLunga = typeof long === 'string' ? long : (long._ || long.$?.Value || null);
        } else if (attrs.LongDesc) {
            descrizioneLunga = typeof attrs.LongDesc === 'string' ? attrs.LongDesc : (attrs.LongDesc._ || null);
        }

        // Specifiche tecniche
        const features: any[] = [];
        if (product.ProductFeature) {
            const featureArray = Array.isArray(product.ProductFeature)
                ? product.ProductFeature
                : [product.ProductFeature];

            for (const feature of featureArray) {
                const featureAttrs = feature.$ || feature;
                const featureName = feature.Feature?.Name?.$?.Value || featureAttrs.CategoryFeature_Name || '';
                const featureValue = featureAttrs.Presentation_Value || featureAttrs.Value || '';

                if (featureName && featureValue) {
                    features.push({
                        name: featureName,
                        value: featureValue,
                        unit: featureAttrs.Sign || ''
                    });
                }
            }
        }

        // Immagini
        const images: string[] = [];

        // High-res image
        if (attrs.HighPic) {
            images.push(attrs.HighPic);
        }

        // Thumb image
        if (attrs.ThumbPic) {
            images.push(attrs.ThumbPic);
        }

        // Gallery images
        if (product.ProductGallery?.ProductPicture) {
            const pictureArray = Array.isArray(product.ProductGallery.ProductPicture)
                ? product.ProductGallery.ProductPicture
                : [product.ProductGallery.ProductPicture];

            for (const pic of pictureArray) {
                const picAttrs = pic.$ || pic;
                if (picAttrs.Pic) {
                    images.push(picAttrs.Pic);
                }
            }
        }

        // Bullet points (dai primi 5 features più importanti)
        const bulletPoints: string[] = [];
        const topFeatures = features.slice(0, 5);
        for (const feat of topFeatures) {
            bulletPoints.push(`${feat.name}: ${feat.value}${feat.unit ? ' ' + feat.unit : ''}`);
        }

        // Documenti (PDF, manuali)
        const documents: any[] = [];
        if (product.ProductRelated?.ProductRelatedDocument) {
            const docArray = Array.isArray(product.ProductRelated.ProductRelatedDocument)
                ? product.ProductRelated.ProductRelatedDocument
                : [product.ProductRelated.ProductRelatedDocument];

            for (const doc of docArray) {
                const docAttrs = doc.$ || doc;
                if (docAttrs.URL) {
                    documents.push({
                        url: docAttrs.URL,
                        type: docAttrs.Type || 'manual',
                        description: docAttrs.Description || ''
                    });
                }
            }
        }

        return {
            descrizioneBrave,
            descrizioneLunga,
            specificheTecnicheJson: JSON.stringify(features),
            urlImmaginiJson: JSON.stringify(images),
            bulletPointsJson: JSON.stringify(bulletPoints),
            documentiJson: JSON.stringify(documents)
        };
    }

    /**
     * Arricchisce un singolo prodotto del Master File
     */
    private static async enrichSingleProduct(
        masterFileProduct: any, // Contains id, eanGtin
        credentials: { username: string; password: string }
    ): Promise<boolean> {
        try {
            const ean = masterFileProduct.eanGtin;

            // 1. TENTATIVO CON EAN (Veloce, nessuna query extra)
            // Passiamo undefined per MPN e Brand per forzare solo il check EAN
            let productData = await this.fetchProductData(ean, credentials);

            // 2. TENTATIVO CON MPN + BRAND (Solo se EAN fallisce)
            if (!productData) {
                // Ora facciamo la query pesante per trovare MPN
                let mpn = '';
                let brand = '';

                try {
                    // Recupera MPN dai dati raw
                    const rawRecords = await prisma.listinoRaw.findMany({
                        where: { eanGtin: ean },
                        take: 5,
                        select: { altriCampiJson: true } // Select only needed field
                    });

                    for (const raw of rawRecords) {
                        if (raw.altriCampiJson) {
                            try {
                                const data = JSON.parse(raw.altriCampiJson);
                                if (data.CodiceProduttore) { mpn = data.CodiceProduttore; break; }
                                if (data.CodArtFor) { mpn = data.CodArtFor; break; }
                                if (data.CodiceArticoloProduttore) { mpn = data.CodiceArticoloProduttore; break; }
                            } catch { }
                        }
                    }

                    // Recupera Brand se non l'abbiamo già nel masterFileProduct
                    // NOTA: enrichMasterFile ora dovrebbe passare i dati necessari per evitare query qui
                    // Ma per compatibilità, facciamo query se manca
                    if (masterFileProduct.marchio?.nome) {
                        brand = masterFileProduct.marchio.nome;
                    } else {
                        const fullProduct = await prisma.masterFile.findUnique({
                            where: { id: masterFileProduct.id },
                            select: { marchio: { select: { nome: true } } }
                        });
                        brand = fullProduct?.marchio?.nome || '';
                    }

                } catch (err) {
                    logger.warn(`Errore recupero dati estesi per EAN ${ean}: ${err}`);
                }

                // Riprova con MPN se trovati
                if (mpn && brand) {
                    // fetchProductData è intelligente: se gli passi MPN/Brand, prova quelli se EAN fallisce.
                    // Ma noi abbiamo già provato EAN sopra (implicitamente, o chiamandolo con args vuoti).
                    // In realtà fetchProductData fa: if (ean) try; if (!found && mpn) try;
                    // Quindi potevamo chiamarlo una volta sola SE avessimo avuto MPN subito.
                    // Ma siccome recuperare MPN è costoso, lo facciamo lazy.
                    // Quindi qui chiamiamo fetchProductData passando MPN e Brand.
                    // Lui riproverà EAN (inutile ma veloce se cacheata o se request è cheap) poi MPN.
                    // O meglio: modifichiamo fetchProductData? No, usiamo la logica esistente.
                    productData = await this.fetchProductData(ean, credentials, mpn, brand);
                }
            }

            if (!productData) {
                // logger.debug(`Nessun dato Icecat per EAN ${ean}`);
                return false;
            }

            // Estrai e formatta dati
            const extractedData = this.extractProductData(productData, ean);

            // Salva o aggiorna in database
            await prisma.datiIcecat.upsert({
                where: { masterFileId: masterFileProduct.id },
                create: {
                    masterFileId: masterFileProduct.id,
                    eanGtin: ean,
                    ...extractedData,
                    linguaOriginale: this.DEFAULT_LANGUAGE
                },
                update: {
                    ...extractedData,
                    updatedAt: new Date()
                }
            });

            // logger.info(`✅ Arricchito prodotto ${ean}`);
            return true;

        } catch (error: any) {
            logger.error(`Errore arricchimento prodotto ${masterFileProduct.eanGtin}:`, error.message);
            return false;
        }
    }

    /**
     * Arricchisce tutti i prodotti del Master File con dati Icecat
     */
    static async enrichMasterFile(): Promise<{
        total: number;
        enriched: number;
        skipped: number;
        errors: number;
    }> {
        logger.info('🔍 Inizio arricchimento Master File con Icecat (Ottimizzato)');

        const startTime = Date.now();
        let enriched = 0;
        let skipped = 0;
        let errors = 0;

        try {
            // Ottieni credenziali
            const credentials = await this.getCredentials();

            // Recupera prodotti non ancora arricchiti
            // Include marchio per evitare query extra in enrichSingleProduct
            const products = await prisma.masterFile.findMany({
                where: {
                    OR: [
                        { datiIcecat: null },
                        { datiIcecat: { urlImmaginiJson: '[]' } },
                        { datiIcecat: { specificheTecnicheJson: '[]' } }
                    ]
                },
                select: {
                    id: true,
                    eanGtin: true,
                    marchio: {
                        select: { nome: true }
                    }
                }
            });

            logger.info(`📦 Trovati ${products.length} prodotti da arricchire`);

            // Processa in batch PARALLELI
            // concurrency limit: 5-10
            const BATCH_SIZE = 10;

            for (let i = 0; i < products.length; i += BATCH_SIZE) {
                const batch = products.slice(i, i + BATCH_SIZE);

                // Process batch in parallel
                const results = await Promise.all(
                    batch.map(product => this.enrichSingleProduct(product, credentials))
                );

                // Update counters
                results.forEach(success => {
                    if (success) enriched++;
                    else skipped++;
                });

                // Piccola pausa tra i batch per rate limiting
                // 1000ms ogni 10 richieste = ~10 req/s max
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Log progresso ogni batch
                const progress = ((Math.min(i + BATCH_SIZE, products.length)) / products.length * 100).toFixed(1);
                logger.info(`📊 Progresso: ${progress}% (${Math.min(i + BATCH_SIZE, products.length)}/${products.length})`);
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.info(`✨ Arricchimento completato in ${duration}s`);
            logger.info(`   Arricchiti: ${enriched}, Saltati: ${skipped}, Errori: ${errors}`);

            return {
                total: products.length,
                enriched,
                skipped,
                errors
            };

        } catch (error: any) {
            logger.error('❌ Errore durante arricchimento Icecat:', error);
            throw error;
        }
    }

    /**
     * Ottiene prodotti arricchiti con paginazione
     */
    static async getEnrichedProducts(page: number = 1, limit: number = 20): Promise<{
        data: any[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }> {
        const skip = (page - 1) * limit;

        const [total, products] = await Promise.all([
            prisma.datiIcecat.count(),
            prisma.datiIcecat.findMany({
                skip,
                take: limit,
                include: {
                    masterFile: {
                        include: {
                            marchio: true,
                            categoria: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            })
        ]);

        return {
            data: products,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Ottiene il progresso dell'arricchimento
     */
    static async getEnrichmentProgress(): Promise<{
        totalProducts: number;
        enrichedProducts: number;
        pendingProducts: number;
        percentage: number;
    }> {
        const [totalProducts, enrichedProducts] = await Promise.all([
            prisma.masterFile.count(),
            prisma.datiIcecat.count()
        ]);

        const pendingProducts = totalProducts - enrichedProducts;
        const percentage = totalProducts > 0
            ? Math.round((enrichedProducts / totalProducts) * 100)
            : 0;

        return {
            totalProducts,
            enrichedProducts,
            pendingProducts,
            percentage
        };
    }
}
