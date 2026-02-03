// @ts-nocheck
import { Response } from 'express';
import { AIEnrichmentService } from '../services/AIEnrichmentService';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

/**
 * Controller per l'arricchimento dati tramite AI (Gemini) - Multi-Tenant
 */
export class AIEnrichmentController {

    /**
     * POST /api/ai/enrich
     */
    enrichBatch = asyncHandler(async (req: AuthRequest, res: Response) => {
        const utenteId = req.utenteId;
        if (!utenteId) throw new AppError('Non autorizzato', 401);

        const limit = parseInt(req.query.limit as string) || 20;

        // Rispondi subito (processo in background)
        AIEnrichmentService.processBatch(utenteId, limit).catch(err =>
            console.error(`Errore durante arricchimento AI background utente ${utenteId}:`, err)
        );

        res.json({
            success: true,
            message: `Arricchimento AI avviato per ${limit} prodotti in background.`
        });
    });

    /**
     * GET /api/ai/stats
     */
    getStats = asyncHandler(async (req: AuthRequest, res: Response) => {
        const utenteId = req.utenteId;
        if (!utenteId) throw new AppError('Non autorizzato', 401);

        const [total, processed, errors] = await Promise.all([
            prisma.masterFile.count({ where: { utenteId } }),
            prisma.outputShopify.count({ where: { utenteId, handle: { not: { equals: "" } } } }),
            prisma.outputShopify.count({ where: { utenteId, statoCaricamento: 'error' } })
        ]);

        res.json({
            success: true,
            data: {
                total,
                processed,
                pending: Math.max(0, total - processed),
                errors,
                percentage: total > 0 ? Math.round((processed / total) * 100) : 0
            }
        });
    });
}

export const aiEnrichmentController = new AIEnrichmentController();
