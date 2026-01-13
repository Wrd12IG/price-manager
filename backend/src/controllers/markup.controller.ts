import { Request, Response } from 'express';
import { MarkupService } from '../services/MarkupService';
import { asyncHandler } from '../middleware/errorHandler';
import prisma from '../config/database';

/**
 * GET /api/markup
 * Lista tutte le regole
 */
export const getRegole = asyncHandler(async (req: Request, res: Response) => {
    const regole = await MarkupService.getRegole();
    res.json({
        success: true,
        data: regole
    });
});

/**
 * POST /api/markup
 * Crea nuova regola
 */
export const createRegola = asyncHandler(async (req: Request, res: Response) => {
    const regola = await MarkupService.createRegola(req.body);

    // Ricalcola immediatamente i prezzi
    await MarkupService.applicaRegolePrezzi();

    res.status(201).json({
        success: true,
        data: regola,
        message: 'Regola creata e prezzi ricalcolati'
    });
});

/**
 * DELETE /api/markup/:id
 * Elimina regola
 */
export const deleteRegola = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await MarkupService.deleteRegola(parseInt(id));

    // Ricalcola immediatamente i prezzi per riflettere la cancellazione
    await MarkupService.applicaRegolePrezzi();

    res.json({
        success: true,
        message: 'Regola eliminata e prezzi ricalcolati'
    });
});

/**
 * POST /api/markup/calculate
 * Avvia ricalcolo prezzi massivo
 */
export const calculatePrices = asyncHandler(async (req: Request, res: Response) => {
    const result = await MarkupService.applicaRegolePrezzi();
    res.json({
        success: true,
        message: 'Calcolo prezzi completato',
        data: result
    });
});

/**
 * GET /api/markup/options
 * Ottiene le opzioni disponibili (marche, categorie) per le regole di markup
 * Query params:
 *   - fornitoreId (optional): Se specificato, restituisce solo le opzioni di quel fornitore
 */
export const getOptions = asyncHandler(async (req: Request, res: Response) => {
    const { fornitoreId } = req.query;

    const options = await MarkupService.getAvailableOptionsForMarkup(
        fornitoreId ? parseInt(fornitoreId as string) : undefined
    );


    res.json({
        success: true,
        data: options
    });
});
