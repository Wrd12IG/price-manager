// @ts-nocheck
import { Response } from 'express';
import prisma from '../config/database';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

/**
 * Controller per gestione Marchi (Multi-Tenant)
 */

export const getMarchi = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { search, attivo } = req.query;
    const utenteId = req.utenteId;

    if (!utenteId) throw new AppError('Non autorizzato', 401);

    // Recuperiamo tutti i marchi, con il conteggio di utilizzo SPECIFICO per l'utente loggato
    const marchi = await prisma.marchio.findMany({
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
        data: marchi,
        total: marchi.length
    });
});

// GET /api/marchi/:id - Dettaglio marchio (con check proprietà)
export const getMarchioById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const utenteId = req.utenteId;

    const marchio = await prisma.marchio.findUnique({
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

    if (!marchio) {
        throw new AppError('Marchio non trovato', 404);
    }

    res.json({
        success: true,
        data: marchio
    });
});

// POST /api/marchi - Crea nuovo marchio (Accesso solo Admin o automatizzato)
export const createMarchio = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { nome, note } = req.body;
    if (!nome) throw new AppError('Il nome del marchio è obbligatorio', 400);

    const normalizzato = nome.trim().toUpperCase();
    const existing = await prisma.marchio.findFirst({ where: { normalizzato } });

    if (existing) {
        res.json({ success: true, data: existing, message: 'Marchio già esistente' });
        return;
    }

    const marchio = await prisma.marchio.create({
        data: { nome: nome.trim(), normalizzato, note }
    });

    logger.info(`Marchio creato: ${marchio.nome}`);
    res.status(201).json({ success: true, data: marchio });
});

export const updateMarchio = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    if (!utenteId) throw new AppError('Non autorizzato', 401);

    const { id } = req.params;
    const { nome, attivo, note } = req.body;

    if (!nome || !nome.trim()) throw new AppError('Il nome del marchio è obbligatorio', 400);

    // Ownership check: l'utente può modificare se ha prodotti con questo marchio
    // OPPURE se il marchio è NUOVO (non ha prodotti per NESSUN utente)
    // OPPURE se è admin (utenteId === 1 o ruolo admin)
    const isAdmin = utenteId === 1 || req.user?.ruolo === 'admin';
    const hasUserProducts = await prisma.masterFile.findFirst({ where: { marchioId: parseInt(id), utenteId } });
    const hasGlobalProducts = await prisma.masterFile.findFirst({ where: { marchioId: parseInt(id) } });

    if (!isAdmin && !hasUserProducts && hasGlobalProducts) {
        throw new AppError('Non hai il permesso di modificare questo marchio (è usato da altri utenti)', 403);
    }

    const normalizzato = nome.trim().toUpperCase();
    const marchio = await prisma.marchio.update({
        where: { id: parseInt(id) },
        data: { nome: nome.trim(), normalizzato, attivo: attivo ?? true, note: note || null }
    });

    logger.info(`Marchio aggiornato da utente ${utenteId}: ${marchio.nome}`);
    res.json({ success: true, data: marchio });
});

export const deleteMarchio = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    if (!utenteId) throw new AppError('Non autorizzato', 401);

    const { id } = req.params;

    // Verifica permessi per eliminazione (stessa logica di update)
    const isAdmin = utenteId === 1 || req.user?.ruolo === 'admin';
    const hasUserProducts = await prisma.masterFile.findFirst({ where: { marchioId: parseInt(id), utenteId } });
    const hasGlobalProducts = await prisma.masterFile.findFirst({ where: { marchioId: parseInt(id) } });

    if (!isAdmin && !hasUserProducts && hasGlobalProducts) {
        throw new AppError('Non puoi eliminare un marchio usato da altri utenti', 403);
    }

    // Controlla che non sia usato (prodotti, regole markup, filtri)
    const usageCount = await prisma.marchio.findUnique({
        where: { id: parseInt(id) },
        include: { _count: { select: { masterFiles: true, regoleMarkup: true } } }
    });
    const total = (usageCount?._count.masterFiles ?? 0) + (usageCount?._count.regoleMarkup ?? 0);
    if (total > 0) throw new AppError(`Impossibile eliminare: il marchio è usato in ${total} record`, 409);

    await prisma.marchio.delete({ where: { id: parseInt(id) } });
    logger.info(`Marchio eliminato da utente ${utenteId}: ID ${id}`);
    res.json({ success: true, message: 'Marchio eliminato' });
});

export const cleanupMarchi = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    // Solo l'admin può fare cleanup globale
    if (utenteId !== 1 && req.user?.ruolo !== 'admin') {
        throw new AppError('Solo gli amministratori possono eseguire il cleanup dei marchi', 403);
    }

    // Trova marchi che NON hanno prodotti in TUTTO il sistema
    const marchiInUso = await prisma.masterFile.findMany({
        where: { marchioId: { not: null } },
        select: { marchioId: true },
        distinct: ['marchioId']
    });
    const idsInUso = marchiInUso.map(m => m.marchioId!);

    // Marca come inattivi quelli che nessuno usa più
    const result = await prisma.marchio.updateMany({
        where: { id: { notIn: idsInUso }, attivo: true },
        data: { attivo: false }
    });

    logger.info(`Cleanup marchi: disattivati ${result.count} marchi inutilizzati`);
    res.json({ success: true, message: `Disattivati ${result.count} marchi non utilizzati`, data: { count: result.count } });
});
