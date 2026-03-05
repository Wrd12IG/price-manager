// @ts-nocheck
import { Response } from 'express';
import prisma from '../config/database';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

/**
 * Controller per gestione Categorie (Multi-Tenant)
 */

// GET /api/categorie - Lista le categorie dell'UTENTE loggato
export const getCategorie = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { search } = req.query;
    const utenteId = req.utenteId;

    if (!utenteId) throw new AppError('Non autorizzato', 401);

    // Recuperiamo le categorie distinte che hanno ALMENO un prodotto nel MasterFile dell'utente
    const categoriesFromMaster = await prisma.masterFile.findMany({
        where: {
            utenteId,
            categoriaId: { not: null },
            ...(search ? {
                categoria: {
                    nome: { contains: search as string }
                }
            } : {})
        },
        select: {
            categoria: {
                include: {
                    _count: {
                        select: {
                            masterFiles: { where: { utenteId } },
                            regoleMarkup: { where: { utenteId } }
                        }
                    }
                }
            }
        },
        distinct: ['categoriaId']
    });

    const data = categoriesFromMaster
        .map(c => c.categoria)
        .filter(Boolean)
        .sort((a, b) => a.nome.localeCompare(b.nome));

    res.json({
        success: true,
        data: data,
        total: data.length
    });
});

// GET /api/categorie/:id - Dettaglio categoria (con check proprietà)
export const getCategoriaById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const utenteId = req.utenteId;

    // Verifichiamo che l'utente abbia almeno un prodotto di questa categoria
    const hasProduct = await prisma.masterFile.findFirst({
        where: { categoriaId: parseInt(id), utenteId }
    });

    if (!hasProduct) {
        throw new AppError('Categoria non trovata o non associata ai tuoi prodotti', 404);
    }

    const categoria = await prisma.categoria.findUnique({
        where: { id: parseInt(id) },
        include: {
            _count: {
                select: {
                    masterFiles: { where: { utenteId } },
                    regoleMarkup: { where: { utenteId } }
                }
            }
        }
    });

    res.json({
        success: true,
        data: categoria
    });
});

// POST /api/categorie - Crea nuova categoria (Solo Admin o auto)
export const createCategoria = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { nome, note } = req.body;
    if (!nome) throw new AppError('Il nome della categoria è obbligatorio', 400);

    const normalizzato = nome.trim().toUpperCase();
    const existing = await prisma.categoria.findFirst({ where: { normalizzato } });

    if (existing) {
        res.json({ success: true, data: existing, message: 'Categoria già esistente' });
        return;
    }

    const categoria = await prisma.categoria.create({
        data: { nome: nome.trim(), normalizzato, note }
    });

    logger.info(`Categoria creata: ${categoria.nome}`);
    res.status(201).json({ success: true, data: categoria });
});

export const updateCategoria = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    if (!utenteId) throw new AppError('Non autorizzato', 401);

    const { id } = req.params;
    const { nome, attivo, note } = req.body;

    if (!nome || !nome.trim()) throw new AppError('Il nome della categoria è obbligatorio', 400);

    // Verifica ownership: l'utente deve avere almeno un prodotto con questa categoria
    const hasProduct = await prisma.masterFile.findFirst({
        where: { categoriaId: parseInt(id), utenteId }
    });
    if (!hasProduct) throw new AppError('Categoria non trovata o non associata ai tuoi prodotti', 403);

    const normalizzato = nome.trim().toUpperCase();
    const categoria = await prisma.categoria.update({
        where: { id: parseInt(id) },
        data: { nome: nome.trim(), normalizzato, attivo: attivo ?? true, note: note || null }
    });

    logger.info(`Categoria aggiornata da utente ${utenteId}: ${categoria.nome}`);
    res.json({ success: true, data: categoria });
});

export const deleteCategoria = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    if (!utenteId) throw new AppError('Non autorizzato', 401);

    const { id } = req.params;

    // Verifica ownership
    const hasProduct = await prisma.masterFile.findFirst({
        where: { categoriaId: parseInt(id), utenteId }
    });
    if (!hasProduct) throw new AppError('Categoria non trovata o non associata ai tuoi prodotti', 403);

    // Controlla che non sia usata
    const usageCount = await prisma.categoria.findUnique({
        where: { id: parseInt(id) },
        include: { _count: { select: { masterFiles: true, regoleMarkup: true } } }
    });
    const total = (usageCount?._count.masterFiles ?? 0) + (usageCount?._count.regoleMarkup ?? 0);
    if (total > 0) throw new AppError(`Impossibile eliminare: la categoria è usata in ${total} record`, 409);

    await prisma.categoria.delete({ where: { id: parseInt(id) } });
    logger.info(`Categoria eliminata da utente ${utenteId}: ID ${id}`);
    res.json({ success: true, message: 'Categoria eliminata' });
});
