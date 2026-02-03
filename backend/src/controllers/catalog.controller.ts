// @ts-nocheck
import { Response } from 'express';
import prisma from '../config/database';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';

/**
 * GET /api/catalog/marche
 */
export const getMarche = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { fornitoreId } = req.query;
    const utenteId = req.utenteId;

    if (!utenteId) throw new AppError('Non autorizzato', 401);

    const where: any = { utenteId };
    if (fornitoreId) {
        where.fornitoreSelezionatoId = parseInt(fornitoreId as string);
    }

    const marchiFromMasterFile = await prisma.masterFile.findMany({
        where,
        select: {
            marchio: { select: { nome: true } }
        },
        distinct: ['marchioId']
    });

    const marche = marchiFromMasterFile
        .map(m => m.marchio?.nome)
        .filter(Boolean)
        .sort();

    res.json({ success: true, data: [...new Set(marche)] });
});

/**
 * GET /api/catalog/categorie
 */
export const getCategorie = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { fornitoreId } = req.query;
    const utenteId = req.utenteId;

    if (!utenteId) throw new AppError('Non autorizzato', 401);

    const where: any = { utenteId };
    if (fornitoreId) {
        where.fornitoreSelezionatoId = parseInt(fornitoreId as string);
    }

    const categorieFromMasterFile = await prisma.masterFile.findMany({
        where,
        select: {
            categoria: { select: { nome: true } }
        },
        distinct: ['categoriaId']
    });

    const categorie = categorieFromMasterFile
        .map(c => c.categoria?.nome)
        .filter(Boolean)
        .sort();

    res.json({ success: true, data: [...new Set(categorie)] });
});
