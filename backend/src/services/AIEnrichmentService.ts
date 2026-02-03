// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { WebScrapingEnrichmentService } from './WebScrapingEnrichmentService';
import { AITitleService } from './AITitleService';
import { AIDescriptionService } from './AIDescriptionService';
import { AIMetafieldService } from './AIMetafieldService';
import { jobProgressManager } from './JobProgressService';
import prisma from '../config/database';

export class AIEnrichmentService {

    /**
     * Genera contenuto completo per un prodotto dell'utente usando AI
     */
    static async generateProductContent(utenteId: number, masterFileId: number) {
        const product = await prisma.masterFile.findFirst({
            where: { id: masterFileId, utenteId },
            include: { datiIcecat: true, marchio: true, categoria: true }
        });

        if (!product) return false;

        const icecat = product.datiIcecat;
        if (!icecat) return false;

        const features: any[] = JSON.parse(icecat.specificheTecnicheJson || '[]');
        const bullets: string[] = JSON.parse(icecat.bulletPointsJson || '[]');

        const brand = product.marchio?.nome || 'Generico';
        const category = product.categoria?.nome || 'Hardware';

        // --- EVOLUZIONE AI: Generazione Titolo e Descrizione con Gemini ---
        const aiTitle = await AITitleService.generateProductTitle(
            utenteId,
            product.eanGtin,
            brand,
            category,
            product.nomeProdotto,
            icecat.descrizioneLunga,
            features
        );

        const aiDescription = await AIDescriptionService.generateProductDescription(
            utenteId,
            aiTitle,
            brand,
            category,
            features,
            bullets
        );

        const aiMetafields = await AIMetafieldService.generateMetafields(utenteId, product);

        await prisma.outputShopify.upsert({
            where: { masterFileId: product.id },
            create: {
                utenteId,
                masterFileId: product.id,
                handle: `${aiTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${product.id}`,
                title: aiTitle,
                bodyHtml: aiDescription,
                vendor: brand,
                productType: category,
                tags: `${brand}, ${category}, AI Enriched`,
                sku: product.partNumber,
                barcode: product.eanGtin,
                variantPrice: product.prezzoVenditaCalcolato,
                variantInventoryQty: product.quantitaTotaleAggregata,
                immaginiUrls: icecat.urlImmaginiJson,
                metafieldsJson: aiMetafields ? JSON.stringify(aiMetafields) : null,
                statoCaricamento: 'pending'
            },
            update: {
                title: aiTitle,
                bodyHtml: aiDescription,
                vendor: brand,
                productType: category,
                tags: `${brand}, ${category}, AI Enriched`,
                sku: product.partNumber,
                barcode: product.eanGtin,
                variantPrice: product.prezzoVenditaCalcolato,
                variantInventoryQty: product.quantitaTotaleAggregata,
                immaginiUrls: icecat.urlImmaginiJson,
                metafieldsJson: aiMetafields ? JSON.stringify(aiMetafields) : null,
                statoCaricamento: 'pending',
                updatedAt: new Date()
            }
        });

        return true;
    }

    static async processBatch(utenteId: number, limit: number = 50) {
        const products = await prisma.masterFile.findMany({
            where: {
                utenteId,
                datiIcecat: { isNot: null },
                outputShopify: { is: null }
            },
            take: limit
        });

        if (products.length === 0) return { processed: 0, success: 0 };

        const jobId = jobProgressManager.createJob('enrichment', { utenteId, total: products.length });
        jobProgressManager.startJob(jobId, `Arricchimento AI in corso per ${products.length} prodotti...`);

        let success = 0;
        const CONCURRENCY = 3;

        for (let i = 0; i < products.length; i += CONCURRENCY) {
            const chunk = products.slice(i, i + CONCURRENCY);
            const results = await Promise.all(chunk.map(async (p) => {
                try {
                    if (await this.generateProductContent(utenteId, p.id)) {
                        return true;
                    }
                } catch (e) {
                    logger.error(`Errore AI prodotto ${p.id}: ${e.message}`);
                }
                return false;
            }));

            success += results.filter(Boolean).length;

            jobProgressManager.updateProgress(
                jobId,
                Math.round(((i + chunk.length) / products.length) * 100),
                `Ottimizzazione AI: ${i + chunk.length}/${products.length}`
            );

            // Un piccolo delay tra i chunk per evitare rate limit troppo aggressivi
            if (i + CONCURRENCY < products.length) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        jobProgressManager.completeJob(jobId, `Ottimizzazione completata: ${success} prodotti pronti per lo store`);
        return { processed: products.length, success };
    }
}
