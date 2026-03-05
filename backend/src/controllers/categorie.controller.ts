// @ts-nocheck
import { Response } from 'express';
import prisma from '../config/database';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

/**
 * Controller per gestione Categorie (Multi-Tenant)
 */

export const getCategorie = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { search, attivo } = req.query;
    const utenteId = req.utenteId;

    if (!utenteId) throw new AppError('Non autorizzato', 401);

    // Recuperiamo tutte le categorie, con conteggio specifico per l'utente loggato
    const categorie = await prisma.categoria.findMany({
        where: {
            ...(attivo === 'true' ? { attivo: true } : {}),
            ...(search ? {
                OR: [
                    { nome: { contains: search as string, mode: 'insensitive' } },
                    { normalizzato: { contains: (search as string).toUpperCase() } }
                ]
            } : {})
        },
        include: {
            _count: {
                select: {
                    masterFiles: { where: { utenteId } },
                    regoleMarkup: { where: { utenteId } },
                    filtri: { where: { utenteId } }
                }
            }
        },
        orderBy: { nome: 'asc' }
    });

    res.json({
        success: true,
        data: categorie,
        total: categorie.length
    });
});

// GET /api/categorie/:id - Dettaglio categoria (con check proprietà)
export const getCategoriaById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const utenteId = req.utenteId;

    const categoria = await prisma.categoria.findUnique({
        where: { id: parseInt(id) },
        include: {
            _count: {
                select: {
                    masterFiles: { where: { utenteId } },
                    regoleMarkup: { where: { utenteId } },
                    filtri: { where: { utenteId } }
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

    // Ownership check logic
    const isAdmin = utenteId === 1 || req.user?.ruolo === 'admin';
    const hasUserProducts = await prisma.masterFile.findFirst({ where: { categoriaId: parseInt(id), utenteId } });
    const hasGlobalProducts = await prisma.masterFile.findFirst({ where: { categoriaId: parseInt(id) } });

    if (!isAdmin && !hasUserProducts && hasGlobalProducts) {
        throw new AppError('Non hai il permesso di modificare questa categoria (è usata da altri utenti)', 403);
    }

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

    // Ownership check logic for deletion
    const isAdmin = utenteId === 1 || req.user?.ruolo === 'admin';
    const hasUserProducts = await prisma.masterFile.findFirst({ where: { categoriaId: parseInt(id), utenteId } });
    const hasGlobalProducts = await prisma.masterFile.findFirst({ where: { categoriaId: parseInt(id) } });

    if (!isAdmin && !hasUserProducts && hasGlobalProducts) {
        throw new AppError('Non puoi eliminare una categoria usata da altri utenti', 403);
    }

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

export const cleanupCategorie = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    if (utenteId !== 1 && req.user?.ruolo !== 'admin') {
        throw new AppError('Solo gli amministratori possono eseguire il cleanup delle categorie', 403);
    }

    const categorieInUso = await prisma.masterFile.findMany({
        where: { categoriaId: { not: null } },
        select: { categoriaId: true },
        distinct: ['categoriaId']
    });
    const idsInUso = categorieInUso.map(c => c.categoriaId!);

    const result = await prisma.categoria.updateMany({
        where: { id: { notIn: idsInUso }, attivo: true },
        data: { attivo: false }
    });

    logger.info(`Cleanup categorie: disattivate ${result.count} categorie inutilizzate`);
    res.json({ success: true, message: `Disattivate ${result.count} categorie non utilizzate`, data: { count: result.count } });
});
