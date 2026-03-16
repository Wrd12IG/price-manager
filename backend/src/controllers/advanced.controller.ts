// @ts-nocheck
import { Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { DuplicateDetectionService } from '../services/DuplicateDetectionService';
import { CompetitivePricingService } from '../services/CompetitivePricingService';
import { MetafieldReviewService } from '../services/MetafieldReviewService';
import { logger } from '../utils/logger';
import prisma from '../config/database'; // ADDED PRISMA IMPORT

// ─────────────────────────────────────────────────────────
// #13 — DUPLICATE DETECTION
// ─────────────────────────────────────────────────────────

/**
 * GET /api/master-file/duplicates?threshold=0.82&limit=50
 */
export const getDuplicates = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const threshold = parseFloat((req.query.threshold as string) || '0.82');
    const limit = parseInt((req.query.limit as string) || '50');

    const groups = await DuplicateDetectionService.findDuplicates(utenteId, threshold, limit);
    res.json({ success: true, data: { groups, total: groups.length } });
});

/**
 * POST /api/master-file/duplicates/ignore
 * Body: { productIdA, productIdB }
 * Marca la coppia come "non duplicata" — non verrà mostrata nelle prossime analisi
 */
export const ignoreDuplicatePair = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const { productIdA, productIdB } = req.body;
    if (!productIdA || !productIdB) throw new AppError('productIdA e productIdB richiesti', 400);

    await DuplicateDetectionService.ignorePair(utenteId, productIdA, productIdB);
    res.json({ success: true, message: 'Coppia ignorata. Non verrà più segnalata come duplicato.' });
});

// ─────────────────────────────────────────────────────────
// #14 — COMPETITIVE PRICING
// ─────────────────────────────────────────────────────────

/**
 * GET /api/pricing/competitive-suggest/:masterFileId
 */
export const getCompetitiveSuggestion = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const masterFileId = parseInt(req.params.masterFileId);
    if (!masterFileId) throw new AppError('masterFileId richiesto', 400);

    const result = await CompetitivePricingService.suggestCompetitivePrice(utenteId, masterFileId);
    res.json({ success: true, data: result });
});

/**
 * GET /api/pricing/competitor-prices/:masterFileId
 */
export const getCompetitorPrices = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const masterFileId = parseInt(req.params.masterFileId);
    if (!masterFileId) throw new AppError('masterFileId richiesto', 400);

    const prices = await CompetitivePricingService.getCompetitorPrices(utenteId, masterFileId);
    res.json({ success: true, data: prices });
});

/**
 * POST /api/pricing/competitor-prices
 * Body: { masterFileId, eanGtin?, source, sourceLabel?, prezzoRilevato, url? }
 */
export const addCompetitorPrice = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const { masterFileId, eanGtin, partNumber, source, sourceLabel, prezzoRilevato, url } = req.body;
    if (!source || !prezzoRilevato) throw new AppError('source e prezzoRilevato richiesti', 400);
    if (prezzoRilevato <= 0) throw new AppError('prezzoRilevato deve essere > 0', 400);

    const record = await CompetitivePricingService.addCompetitorPrice(utenteId, {
        masterFileId, eanGtin, partNumber, source, sourceLabel, prezzoRilevato: parseFloat(prezzoRilevato), url
    });
    res.json({ success: true, data: record, message: 'Prezzo competitor aggiunto.' });
});

/**
 * DELETE /api/pricing/competitor-prices/:id
 */
export const deleteCompetitorPrice = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const id = parseInt(req.params.id);
    if (!id) throw new AppError('ID richiesto', 400);

    await CompetitivePricingService.deleteCompetitorPrice(utenteId, id);
    res.json({ success: true, message: 'Prezzo competitor eliminato.' });
});

/**
 * GET /api/pricing/market-stats?marchioId=&categoriaId=
 */
export const getMarketStats = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const marchioId = req.query.marchioId ? parseInt(req.query.marchioId as string) : undefined;
    const categoriaId = req.query.categoriaId ? parseInt(req.query.categoriaId as string) : undefined;

    const stats = await CompetitivePricingService.getMarketStats(utenteId, marchioId, categoriaId);
    res.json({ success: true, data: stats });
});

/**
 * POST /api/pricing/positioning-rule
 * Body: { mode, delta, minMarginPct }
 */
export const savePositioningRule = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const { mode, delta, minMarginPct } = req.body;
    if (!mode) throw new AppError('mode richiesto', 400);

    await CompetitivePricingService.savePositioningRule(utenteId, {
        mode,
        delta: parseFloat(delta || 0),
        minMarginPct: parseFloat(minMarginPct || 15)
    });
    res.json({ success: true, message: 'Regola di posizionamento salvata.' });
});

// ─────────────────────────────────────────────────────────
// #15 — AI METAFIELD REVIEW
// ─────────────────────────────────────────────────────────

/**
 * POST /api/shopify/ai-review/:outputId
 * Avvia review AI su un singolo prodotto
 */
export const reviewMetafields = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const outputId = parseInt(req.params.outputId);
    if (!outputId) throw new AppError('outputId richiesto', 400);

    logger.info(`🤖 [Utente ${utenteId}] AI Review richiesta per output ${outputId}`);
    const result = await MetafieldReviewService.reviewOutputProduct(utenteId, outputId);
    res.json({ success: true, data: result });
});

/**
 * POST /api/shopify/ai-review-batch
 * Body: { batchSize? } — Avvia review AI in batch su tutti i pendenti
 */
export const reviewMetafieldsBatch = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const batchSize = parseInt(req.body?.batchSize || '10');

    // Avvio asincrono — risponde immediatamente
    const jobPromise = MetafieldReviewService.reviewBatch(utenteId, Math.min(batchSize, 30));

    res.json({
        success: true,
        message: `AI Review batch avviata per max ${Math.min(batchSize, 30)} prodotti. Il processo è asincrono.`
    });

    // Log del risultato quando ha finito
    jobPromise.then(r => logger.info(`✅ AI Review batch completata: ${JSON.stringify(r)}`))
        .catch(e => logger.error(`❌ AI Review batch error: ${e.message}`));
});


// ─────────────────────────────────────────────────────────
// #16 — EMERGENCY RESET
// ─────────────────────────────────────────────────────────

/**
 * POST /api/advanced/reset-all
 * Esegue il reset completo (MasterFile, OutputShopify, ListinoRaw)
 */
export const fullResetAdmin = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    if (!utenteId) throw new AppError('Non autorizzato', 401);

    logger.warn(`🚨 [Utente ${utenteId}] Avviato Full Reset da API`);

    // 1. Ferma jobs
    await prisma.logElaborazione.updateMany({
        where: { utenteId, stato: 'running' },
        data: { stato: 'stopped', dettagliJson: '{"reason": "Manual full reset"}' }
    });

    // 2. Elimina i dati nell'ordine corretto per le foreign key
    const tables = [
        prisma.competitorPrice,
        prisma.priceHistory,
        prisma.outputShopify,
        prisma.masterFile, 
        prisma.listinoRaw
    ];

    let deletedCounts: any = {};
    for (const table of tables) {
        const result = await (table as any).deleteMany({ where: { utenteId } });
        // @ts-ignore
        deletedCounts[table.name || 'table'] = result.count;
    }

    // 3. Resetta fornitori
    await prisma.fornitore.updateMany({
        where: { utenteId },
        data: { ultimaSincronizzazione: null }
    });

    logger.info(`✅ [Utente ${utenteId}] Full Reset completato.`);
    
    res.json({
        success: true,
        message: 'Reset completo eseguito con successo sul database.',
        details: deletedCounts
    });
});

/**
 * POST /api/advanced/cleanup-titles
 * Esegue la pulizia dei titoli troppo lunghi o di bassa qualità.
 * Rilascia i prodotti per far sì che vengano ri-arricchiti dall'AI.
 */
export const cleanupLongTitles = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    if (!utenteId) throw new AppError('Non autorizzato', 401);

    logger.info(`🔍 [Utente ${utenteId}] Avviata pulizia titoli lunghi...`);

    // 1. Trova prodotti con titoli > 150 caratteri (scarsa qualità/fallback marketing)
    const longTitles = await prisma.outputShopify.findMany({
        where: {
            utenteId,
            OR: [
                { title: { contains: 'Descrizione' } },
                { title: { contains: 'Specifiche' } },
                { title: { contains: 'Dettagli' } },
                { title: { contains: 'Caratteristiche' } },
                {
                    title: {
                        mode: 'insensitive',
                        contains: ' - ' // Spesso i titoli fallback hanno molti ' - '
                    }
                }
            ]
        },
        select: { id: true, title: true }
    });

    // Filtriamo quelli veramente lunghi (> 150)
    const toReset = longTitles.filter(p => p.title.length > 150);

    logger.info(`📊 Trovati ${toReset.length} prodotti con titoli sospetti (>150 char).`);

    if (toReset.length > 0) {
        const ids = toReset.map(p => p.id);
        
        // Reset per AI enrichment
        await prisma.outputShopify.updateMany({
            where: { id: { in: ids } },
            data: {
                aiEnriched: false,
                statoCaricamento: 'pending' // Riporta in coda per caricamento/aggiornamento
            }
        });

        logger.info(`✅ Reset completato per ${toReset.length} prodotti.`);
    }

    // 2. Troncamento forzato per tutti quelli che superano i 255 (limite Shopify)
    // Questo è un "fail-safe" finale
    const limitExceeded = await prisma.outputShopify.findMany({
        where: {
            utenteId,
            title: {
                gt: '' // solo per sicurezza
            }
        },
        select: { id: true, title: true }
    });

    const tooLongForShopify = limitExceeded.filter(p => p.title.length > 250);
    
    if (tooLongForShopify.length > 0) {
        logger.info(`✂️ Troncamento forzato per ${tooLongForShopify.length} prodotti > 250 caratteri.`);
        
        for (const p of tooLongForShopify) {
            await prisma.outputShopify.update({
                where: { id: p.id },
                data: {
                    title: p.title.substring(0, 250).trim()
                }
            });
        }
    }

    res.json({
        success: true,
        message: 'Pulizia titoli completata.',
        data: {
            resetForAi: toReset.length,
            truncatedForShopify: tooLongForShopify.length
        }
    });
});

// ─────────────────────────────────────────────────────────
// NORMALIZZAZIONE CATEGORIE VIA ICECAT
// ─────────────────────────────────────────────────────────

/**
 * POST /api/advanced/normalize-categories
 * Normalizza le categorie dei prodotti nel MasterFile usando le categorie Icecat.
 * Utile per aggiornare retroattivamente i prodotti già arricchiti.
 */
export const normalizeCategories = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    if (!utenteId) throw new AppError('Non autorizzato', 401);

    const { MasterFileService } = await import('../services/MasterFileService');
    const result = await MasterFileService.normalizeCategoriesFromIcecat(utenteId);

    res.json({
        success: true,
        message: `Normalizzazione completata: ${result.normalized}/${result.total} categorie aggiornate da Icecat.`,
        data: result
    });
});
