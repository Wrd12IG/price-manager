import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/**
 * Controller per gestione Marchi
 */

// GET /api/marchi - Lista tutti i marchi
export const getMarchi = asyncHandler(async (req: Request, res: Response) => {
    const { attivo, search } = req.query;

    const where: any = {};

    if (attivo !== undefined) {
        where.attivo = attivo === 'true';
    }

    if (search) {
        where.OR = [
            { nome: { contains: search as string } },
            { normalizzato: { contains: (search as string).toUpperCase() } }
        ];
    }

    const [total, marchi] = await Promise.all([
        prisma.marchio.count({ where }),
        prisma.marchio.findMany({
            where,
            orderBy: { nome: 'asc' },
            include: {
                _count: {
                    select: {
                        masterFiles: true,
                        regoleMarkup: true,
                        filtri: true
                    }
                }
            }
        })
    ]);

    res.json({
        success: true,
        data: marchi,
        total
    });
});

// GET /api/marchi/:id - Dettaglio marchio
export const getMarchioById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const marchio = await prisma.marchio.findUnique({
        where: { id: parseInt(id) },
        include: {
            _count: {
                select: {
                    masterFiles: true,
                    regoleMarkup: true,
                    filtri: true
                }
            }
        }
    });

    if (!marchio) {
        throw new AppError('Marchio non trovato', 404);
    }

    res.json({
        success: true,
        data: marchio
    });
});

// POST /api/marchi - Crea nuovo marchio
export const createMarchio = asyncHandler(async (req: Request, res: Response) => {
    const { nome, note } = req.body;

    if (!nome) {
        throw new AppError('Il nome del marchio è obbligatorio', 400);
    }

    const normalizzato = nome.trim().toUpperCase();

    // Check duplicates
    const existing = await prisma.marchio.findFirst({
        where: { normalizzato }
    });

    if (existing) {
        throw new AppError('Marchio già esistente', 409);
    }

    const marchio = await prisma.marchio.create({
        data: {
            nome: nome.trim(),
            normalizzato,
            note
        }
    });

    logger.info(`Marchio creato: ${marchio.nome} (ID: ${marchio.id})`);

    res.status(201).json({
        success: true,
        data: marchio
    });
});

// PUT /api/marchi/:id - Aggiorna marchio
export const updateMarchio = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { nome, attivo, note } = req.body;

    const marchio = await prisma.marchio.findUnique({
        where: { id: parseInt(id) }
    });

    if (!marchio) {
        throw new AppError('Marchio non trovato', 404);
    }

    const data: any = {};

    if (nome !== undefined) {
        data.nome = nome.trim();
        data.normalizzato = nome.trim().toUpperCase();
    }

    if (attivo !== undefined) {
        data.attivo = attivo;
    }

    if (note !== undefined) {
        data.note = note;
    }

    const updated = await prisma.marchio.update({
        where: { id: parseInt(id) },
        data
    });

    logger.info(`Marchio aggiornato: ${updated.nome} (ID: ${updated.id})`);

    res.json({
        success: true,
        data: updated
    });
});

// DELETE /api/marchi/:id - Elimina marchio
export const deleteMarchio = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const marchio = await prisma.marchio.findUnique({
        where: { id: parseInt(id) },
        include: {
            _count: {
                select: {
                    masterFiles: true,
                    regoleMarkup: true,
                    filtri: true
                }
            }
        }
    });

    if (!marchio) {
        throw new AppError('Marchio non trovato', 404);
    }

    // Check if marchio is in use
    const totalUsage = marchio._count.masterFiles + marchio._count.regoleMarkup + marchio._count.filtri;

    if (totalUsage > 0) {
        throw new AppError(
            `Impossibile eliminare. Il marchio è utilizzato in ${totalUsage} record (${marchio._count.masterFiles} prodotti, ${marchio._count.regoleMarkup} regole pricing, ${marchio._count.filtri} filtri)`,
            400
        );
    }

    await prisma.marchio.delete({
        where: { id: parseInt(id) }
    });

    logger.info(`Marchio eliminato: ${marchio.nome} (ID: ${marchio.id})`);

    res.json({
        success: true,
        message: 'Marchio eliminato con successo'
    });
});
