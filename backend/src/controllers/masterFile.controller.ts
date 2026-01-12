import { Request, Response } from 'express';
import { MasterFileService } from '../services/MasterFileService';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * GET /api/master-file
 * Ottiene il catalogo consolidato paginato
 */
export const getMasterFile = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string || '';

    const result = await MasterFileService.getMasterFile(page, limit, search);

    res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
    });
});

/**
 * POST /api/master-file/consolidate
 * Avvia il processo di consolidamento manuale
 */
export const consolidateMasterFile = asyncHandler(async (req: Request, res: Response) => {
    const result = await MasterFileService.consolidaMasterFile();

    res.json({
        success: true,
        message: 'Consolidamento completato',
        data: result
    });
});
