// @ts-nocheck
import { Response } from 'express';
import { MasterFileService } from '../services/MasterFileService';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';

/**
 * GET /api/master-file
 * Ottiene il catalogo consolidato paginato (Multi-Tenant)
 */
export const getMasterFile = asyncHandler(async (req: AuthRequest, res: Response) => {
    const isAdmin = req.user?.ruolo === 'admin' || utenteId === 1;
    const effectiveUtenteId = isAdmin ? null : utenteId;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string || '';
    const filters = {
        marchioId: req.query.marchioId ? parseInt(req.query.marchioId as string) : undefined,
        categoriaId: req.query.categoriaId ? parseInt(req.query.categoriaId as string) : undefined,
        fornitoreId: req.query.fornitoreId ? parseInt(req.query.fornitoreId as string) : undefined,
        utenteId: req.query.utenteId ? parseInt(req.query.utenteId as string) : undefined,
        soloDisponibili: req.query.soloDisponibili === 'true'
    };

    const result = await MasterFileService.getMasterFile(effectiveUtenteId, page, limit, search, filters);

    res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
    });
});

/**
 * POST /api/master-file/consolidate
 * Avvia il processo di consolidamento manuale (Multi-Tenant)
 */
export const consolidateMasterFile = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    if (!utenteId) throw new AppError('Non autorizzato', 401);

    const result = await MasterFileService.consolidaMasterFile(utenteId);

    res.json({
        success: true,
        message: 'Consolidamento completato',
        data: result
    });
});

/**
 * GET /api/master-file/filters
 * Ottiene i valori disponibili per i filtri (Marchi, Categorie, Fornitori che hanno prodotti nel master file)
 */
export const getMasterFileFilters = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const isAdmin = req.user?.ruolo === 'admin' || utenteId === 1;
    const effectiveUtenteId = isAdmin ? null : utenteId;

    const filters = await MasterFileService.getFilterOptions(effectiveUtenteId);

    res.json({
        success: true,
        data: filters
    });
});
