// @ts-nocheck
import { Response } from 'express';
import prisma from '../config/database';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

/**
 * Controller per gestione Marchi (Multi-Tenant)
 */

// GET /api/marchi - Lista i marchi dell'UTENTE loggato
export const getMarchi = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { search } = req.query;
    const utenteId = req.utenteId;

    if (!utenteId) throw new AppError('Non autorizzato', 401);

    // Recuperiamo i marchi distinti che hanno ALMENO un prodotto nel MasterFile dell'utente
    const marchiFromMaster = await prisma.masterFile.findMany({
        where: {
            utenteId,
            marchioId: { not: null },
            ...(search ? {
                marchio: {
                    nome: { contains: search as string }
                }
            } : {})
        },
        select: {
            marchio: {
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
        distinct: ['marchioId']
    });

    const data = marchiFromMaster
        .map(m => m.marchio)
        .filter(Boolean)
        .sort((a, b) => a.nome.localeCompare(b.nome));

    res.json({
        success: true,
        data: data,
        total: data.length
    });
});

// GET /api/marchi/:id - Dettaglio marchio (con check proprietà)
export const getMarchioById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const utenteId = req.utenteId;

    // Verifichiamo che l'utente abbia almeno un prodotto di questo marchio
    const hasProduct = await prisma.masterFile.findFirst({
        where: { marchioId: parseInt(id), utenteId }
    });

    if (!hasProduct) {
        throw new AppError('Marchio non trovato o non associato ai tuoi prodotti', 404);
    }

    const marchio = await prisma.marchio.findUnique({
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

    // Verifica che l'utente abbia almeno un prodotto con questo marchio (ownership)
    const hasProduct = await prisma.masterFile.findFirst({
        where: { marchioId: parseInt(id), utenteId }
    });
    if (!hasProduct) throw new AppError('Marchio non trovato o non associato ai tuoi prodotti', 403);

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

    // Verifica ownership: l'utente deve avere almeno un prodotto con questo marchio
    const hasProduct = await prisma.masterFile.findFirst({
        where: { marchioId: parseInt(id), utenteId }
    });
    if (!hasProduct) throw new AppError('Marchio non trovato o non associato ai tuoi prodotti', 403);

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
    if (!utenteId) throw new AppError('Non autorizzato', 401);

    // Trova marchi che NON hanno prodotti nel masterFile dell'utente
    const usedMarchioIds = (await prisma.masterFile.findMany({
        where: { utenteId, marchioId: { not: null } },
        select: { marchioId: true },
        distinct: ['marchioId']
    })).map(m => m.marchioId!) as number[];

    // Marca come inattivi quelli inutilizzati (non li elimina per sicurezza)
    const result = await prisma.marchio.updateMany({
        where: { id: { notIn: usedMarchioIds }, attivo: true },
        data: { attivo: false }
    });

    logger.info(`Cleanup marchi: disattivati ${result.count} marchi inutilizzati`);
    res.json({ success: true, message: `Disattivati ${result.count} marchi non utilizzati`, data: { count: result.count } });
});
