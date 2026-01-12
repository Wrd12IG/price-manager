import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/**
 * Controller per gestione Categorie
 */

// GET /api/categorie - Lista tutte le categorie
export const getCategorie = asyncHandler(async (req: Request, res: Response) => {
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

    const [total, categorie] = await Promise.all([
        prisma.categoria.count({ where }),
        prisma.categoria.findMany({
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
        data: categorie,
        total
    });
});

// GET /api/categorie/:id - Dettaglio categoria
export const getCategoriaById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const categoria = await prisma.categoria.findUnique({
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

    if (!categoria) {
        throw new AppError('Categoria non trovata', 404);
    }

    res.json({
        success: true,
        data: categoria
    });
});

// POST /api/categorie - Crea nuova categoria
export const createCategoria = asyncHandler(async (req: Request, res: Response) => {
    const { nome, note } = req.body;

    if (!nome) {
        throw new AppError('Il nome della categoria è obbligatorio', 400);
    }

    const normalizzato = nome.trim().toUpperCase();

    // Check duplicates
    const existing = await prisma.categoria.findFirst({
        where: { normalizzato }
    });

    if (existing) {
        throw new AppError('Categoria già esistente', 409);
    }

    const categoria = await prisma.categoria.create({
        data: {
            nome: nome.trim(),
            normalizzato,
            note
        }
    });

    logger.info(`Categoria creata: ${categoria.nome} (ID: ${categoria.id})`);

    res.status(201).json({
        success: true,
        data: categoria
    });
});

// PUT /api/categorie/:id - Aggiorna categoria
export const updateCategoria = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { nome, attivo, note } = req.body;

    const categoria = await prisma.categoria.findUnique({
        where: { id: parseInt(id) }
    });

    if (!categoria) {
        throw new AppError('Categoria non trovata', 404);
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

    const updated = await prisma.categoria.update({
        where: { id: parseInt(id) },
        data
    });

    logger.info(`Categoria aggiornata: ${updated.nome} (ID: ${updated.id})`);

    res.json({
        success: true,
        data: updated
    });
});

// DELETE /api/categorie/:id - Elimina categoria
export const deleteCategoria = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const categoria = await prisma.categoria.findUnique({
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

    if (!categoria) {
        throw new AppError('Categoria non trovata', 404);
    }

    // Check if categoria is in use
    const totalUsage = categoria._count.masterFiles + categoria._count.regoleMarkup + categoria._count.filtri;

    if (totalUsage > 0) {
        throw new AppError(
            `Impossibile eliminare. La categoria è utilizzata in ${totalUsage} record (${categoria._count.masterFiles} prodotti, ${categoria._count.regoleMarkup} regole pricing, ${categoria._count.filtri} filtri)`,
            400
        );
    }

    await prisma.categoria.delete({
        where: { id: parseInt(id) }
    });

    logger.info(`Categoria eliminata: ${categoria.nome} (ID: ${categoria.id})`);

    res.json({
        success: true,
        message: 'Categoria eliminata con successo'
    });
});
