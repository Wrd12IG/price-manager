// @ts-nocheck
import prisma from '../config/database';
import { logger } from '../utils/logger';
import axios from 'axios';
import xml2js from 'xml2js';
import CryptoJS from 'crypto-js';
import { jobProgressManager } from './JobProgressService';

/**
 * Servizio per l'arricchimento dati tramite Icecat API
 */
export class IcecatService {

    private static readonly API_BASE_URL = 'https://data.icecat.biz/xml_s3/xml_server3.cgi';
    private static readonly DEFAULT_LANGUAGE = 'it';
    private static readonly REQUEST_TIMEOUT = 10000;
    private static readonly BATCH_SIZE = 10;
    private static readonly DELAY_BETWEEN_REQUESTS = 500;

    private static async getCredentials(utenteId: number): Promise<{ username: string; password: string }> {
        const configs = await prisma.configurazioneSistema.findMany({
            where: { utenteId, chiave: { in: ['icecat_username', 'icecat_password'] } }
        });

        const u = configs.find(c => c.chiave === 'icecat_username')?.valore;
        const p = configs.find(c => c.chiave === 'icecat_password')?.valore;

        if (!u || !p) throw new Error('Credenziali Icecat non configurate per questo utente');

        const encryptionKey = process.env.ENCRYPTION_KEY || '32-char-secret-key-for-aes-256';
        const decrypted = CryptoJS.AES.decrypt(p, encryptionKey).toString(CryptoJS.enc.Utf8);

        return { username: u, password: decrypted };
    }

    static async saveConfig(utenteId: number, username: string, password: string): Promise<void> {
        const encryptionKey = process.env.ENCRYPTION_KEY || '32-char-secret-key-for-aes-256';
        const encrypted = CryptoJS.AES.encrypt(password, encryptionKey).toString();

        await Promise.all([
            prisma.configurazioneSistema.upsert({
                where: { utenteId_chiave: { utenteId, chiave: 'icecat_username' } },
                create: { utenteId, chiave: 'icecat_username', valore: username },
                update: { valore: username }
            }),
            prisma.configurazioneSistema.upsert({
                where: { utenteId_chiave: { utenteId, chiave: 'icecat_password' } },
                create: { utenteId, chiave: 'icecat_password', valore: encrypted },
                update: { valore: encrypted }
            })
        ]);
    }

    static async getConfig(utenteId: number): Promise<{ username: string; configured: boolean }> {
        const configs = await prisma.configurazioneSistema.findMany({
            where: { utenteId, chiave: { in: ['icecat_username', 'icecat_password'] } }
        });

        const u = configs.find(c => c.chiave === 'icecat_username')?.valore;
        const p = configs.find(c => c.chiave === 'icecat_password')?.valore;

        return { username: u || '', configured: !!(u && p) };
    }

    public static async fetchProductData(ean: string, credentials: { username: string; password: string }, mpn?: string, brand?: string): Promise<any> {
        let url = `${this.API_BASE_URL}?ean_upc=${ean}&lang=${this.DEFAULT_LANGUAGE}&output_product_xml=1`;

        const makeReq = async (requestUrl: string) => {
            try {
                const res = await axios.get(requestUrl, { auth: credentials, timeout: this.REQUEST_TIMEOUT });
                const parser = new xml2js.Parser({ explicitArray: false });
                const result = await parser.parseStringPromise(res.data);
                const product = result['ICECAT-interface']?.Product;
                return (!product || product['@_ErrorMessage']) ? null : product;
            } catch { return null; }
        };

        let product = await makeReq(url);
        if (product) return product;

        if (mpn && brand) {
            url = `${this.API_BASE_URL}?prod_id=${encodeURIComponent(mpn)}&vendor=${encodeURIComponent(brand)}&lang=${this.DEFAULT_LANGUAGE}&output_product_xml=1`;
            return await makeReq(url);
        }
        return null;
    }

    private static extractProductData(product: any): any {
        const attrs = product.$ || product || {};
        let short = '', long = '';

        if (product.SummaryDescription?.ShortSummaryDescription) {
            const s = product.SummaryDescription.ShortSummaryDescription;
            short = typeof s === 'string' ? s : (s._ || s.$?.Value || '');
        }
        if (product.SummaryDescription?.LongSummaryDescription) {
            const l = product.SummaryDescription.LongSummaryDescription;
            long = typeof l === 'string' ? l : (l._ || l.$?.Value || '');
        }

        const features: any[] = [];
        if (product.ProductFeature) {
            const feats = Array.isArray(product.ProductFeature) ? product.ProductFeature : [product.ProductFeature];
            feats.forEach((f: any) => {
                const name = f.Feature?.Name?.$?.Value || '';
                const val = f.$?.Presentation_Value || f.$?.Value || '';
                if (name && val) features.push({ name, value: val });
            });
        }

        const images: string[] = [];
        if (attrs.HighPic) images.push(attrs.HighPic);
        if (product.ProductGallery?.ProductPicture) {
            const pics = Array.isArray(product.ProductGallery.ProductPicture) ? product.ProductGallery.ProductPicture : [product.ProductGallery.ProductPicture];
            pics.forEach((p: any) => { if (p.$?.Pic) images.push(p.$?.Pic); });
        }

        return {
            descrizioneBrave: short,
            descrizioneLunga: long,
            specificheTecnicheJson: JSON.stringify(features),
            urlImmaginiJson: JSON.stringify(images),
            bulletPointsJson: JSON.stringify(features.slice(0, 5).map(f => `${f.name}: ${f.value}`)),
            documentiJson: '[]'
        };
    }

    private static async enrichSingleProduct(utenteId: number, product: any, credentials: { username: string; password: string }): Promise<boolean> {
        try {
            let data = await this.fetchProductData(product.eanGtin, credentials);

            if (!data) {
                const raw = await prisma.listinoRaw.findFirst({ where: { utenteId, eanGtin: product.eanGtin }, select: { partNumber: true } });
                if (raw?.partNumber && product.marchio?.nome) {
                    data = await this.fetchProductData(product.eanGtin, credentials, raw.partNumber, product.marchio.nome);
                }
            }

            if (!data) return false;

            const extracted = this.extractProductData(data);
            await prisma.datiIcecat.upsert({
                where: { masterFileId: product.id },
                create: { masterFileId: product.id, eanGtin: product.eanGtin, ...extracted, linguaOriginale: 'it' },
                update: { ...extracted, updatedAt: new Date() }
            });
            return true;
        } catch { return false; }
    }

    static async enrichMasterFile(utenteId: number): Promise<any> {
        logger.info(`🔍 [Utente ${utenteId}] Inizio arricchimento Icecat`);
        const credentials = await this.getCredentials(utenteId);

        const products = await prisma.masterFile.findMany({
            where: { utenteId, datiIcecat: null },
            include: { marchio: { select: { nome: true } } },
            take: 500 // Ridotto per non bloccare eccessivamente il workflow
        });

        if (products.length === 0) return { total: 0, enriched: 0 };

        const jobId = jobProgressManager.createJob('enrichment', { utenteId, source: 'icecat' });
        jobProgressManager.startJob(jobId, `Download schede tecniche da Icecat per ${products.length} prodotti...`);

        let enriched = 0;
        for (let i = 0; i < products.length; i++) {
            const p = products[i];
            if (await this.enrichSingleProduct(utenteId, p, credentials)) {
                enriched++;
            }

            jobProgressManager.updateProgress(
                jobId,
                Math.round(((i + 1) / products.length) * 100),
                `Arricchimento Icecat: ${i + 1}/${products.length} prodotti`
            );

            await new Promise(r => setTimeout(r, 200));
        }

        jobProgressManager.completeJob(jobId, `Arricchimento Icecat completato: ${enriched} prodotti aggiornati`);
        return { total: products.length, enriched };
    }

    static async getEnrichedProducts(utenteId: number, page: number = 1, limit: number = 20): Promise<any> {
        const skip = (page - 1) * limit;
        const [total, data] = await Promise.all([
            prisma.datiIcecat.count({ where: { masterFile: { utenteId } } }),
            prisma.datiIcecat.findMany({
                where: { masterFile: { utenteId } },
                skip, take: limit,
                include: { masterFile: { include: { marchio: true, categoria: true } } },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    static async getEnrichmentProgress(utenteId: number): Promise<any> {
        const [total, enriched] = await Promise.all([
            prisma.masterFile.count({ where: { utenteId } }),
            prisma.datiIcecat.count({ where: { masterFile: { utenteId } } })
        ]);
        return { total, enriched, pending: total - enriched, percentage: total > 0 ? Math.round((enriched / total) * 100) : 0 };
    }
}
