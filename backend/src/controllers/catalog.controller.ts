import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * GET /api/catalog/marche
 * Restituisce la lista delle marche uniche presenti nei listini raw
 * Opzionale: ?fornitoreId=123
 */
export const getMarche = asyncHandler(async (req: Request, res: Response) => {
    const { fornitoreId } = req.query;

    // Usa la tabella Marchio per ottenere le marche
    // Se filtro per fornitoreId, cerco nel MasterFile i prodotti di quel fornitore
    if (fornitoreId) {
        const marchiFromMasterFile = await prisma.masterFile.findMany({
            where: {
                fornitoreSelezionatoId: parseInt(fornitoreId as string),
                marchioId: { not: null }
            },
            select: {
                marchio: {
                    select: { nome: true }
                }
            },
            distinct: ['marchioId']
        });

        const marche = marchiFromMasterFile
            .map(m => m.marchio?.nome)
            .filter(Boolean)
            .sort();

        res.json({
            success: true,
            data: marche
        });
    } else {
        // Restituisce tutti i marchi attivi
        const marchi = await prisma.marchio.findMany({
            where: { attivo: true },
            select: { nome: true },
            orderBy: { nome: 'asc' }
        });

        res.json({
            success: true,
            data: marchi.map(m => m.nome)
        });
    }
});

/**
 * GET /api/catalog/categorie
 * Restituisce la lista delle categorie uniche presenti nel MasterFile
 * Opzionale: ?fornitoreId=123
 */
export const getCategorie = asyncHandler(async (req: Request, res: Response) => {
    const { fornitoreId } = req.query;

    if (fornitoreId) {
        const categorieFromMasterFile = await prisma.masterFile.findMany({
            where: {
                fornitoreSelezionatoId: parseInt(fornitoreId as string),
                categoriaId: { not: null }
            },
            select: {
                categoria: {
                    select: { nome: true }
                }
            },
            distinct: ['categoriaId']
        });

        const categorie = categorieFromMasterFile
            .map(c => c.categoria?.nome)
            .filter(Boolean)
            .sort();

        res.json({
            success: true,
            data: categorie
        });
    } else {
        // Restituisce tutte le categorie attive
        const categorie = await prisma.categoria.findMany({
            where: { attivo: true },
            select: { nome: true },
            orderBy: { nome: 'asc' }
        });

        res.json({
            success: true,
            data: categorie.map(c => c.nome)
        });
    }
});
