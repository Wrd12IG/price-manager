// @ts-nocheck
import { Response } from 'express';
import { MarkupService } from '../services/MarkupService';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';

/**
 * GET /api/markup
 */
export const getRegole = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const regole = await MarkupService.getRegole(utenteId);
    res.json({
        success: true,
        data: regole
    });
});

/**
 * POST /api/markup
 */
export const createRegola = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const data = { ...req.body, utenteId };
    const regola = await MarkupService.createRegola(data);

    // Ricalcola in background
    MarkupService.applicaRegolePrezzi(utenteId).catch(err =>
        console.error('Errore ricalcolo background dopo creazione:', err)
    );

    res.status(201).json({
        success: true,
        data: regola,
        message: 'Regola creata. Il ricalcolo dei prezzi è iniziato in background.'
    });
});

/**
 * DELETE /api/markup/:id
 */
export const deleteRegola = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const utenteId = req.utenteId;

    await MarkupService.deleteRegola(parseInt(id), utenteId);

    // Ricalcola in background
    MarkupService.applicaRegolePrezzi(utenteId).catch(err =>
        console.error('Errore ricalcolo background dopo eliminazione:', err)
    );

    res.json({
        success: true,
        message: 'Regola eliminata. Il ricalcolo dei prezzi è iniziato in background.'
    });
});

/**
 * POST /api/markup/calculate
 */
export const calculatePrices = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const result = await MarkupService.applicaRegolePrezzi(utenteId);
    res.json({
        success: true,
        message: 'Calcolo prezzi completato',
        data: result
    });
});

/**
 * GET /api/markup/options
 */
export const getOptions = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { fornitoreId } = req.query;
    const utenteId = req.utenteId;

    const options = await MarkupService.getAvailableOptionsForMarkup(
        utenteId,
        fornitoreId ? parseInt(fornitoreId as string) : undefined
    );

    res.json({
        success: true,
        data: options
    });
});
