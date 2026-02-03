// @ts-nocheck
import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

/**
 * GET /api/admin/users
 * Elenco di tutti gli utenti (Merchant)
 */
export const getAllUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
    const users = await (prisma.utente as any).findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            _count: {
                select: {
                    fornitori: true,
                    listiniRaw: true,
                    masterFileRecords: true
                }
            }
        }
    });

    res.json({
        success: true,
        data: users.map((u: any) => ({
            id: u.id,
            nome: u.nome,
            cognome: u.cognome,
            email: u.email,
            ruolo: u.ruolo,
            attivo: u.attivo,
            ultimoAccesso: u.ultimoAccesso,
            createdAt: u.createdAt,
            _count: u._count
        }))
    });
});

/**
 * POST /api/admin/users
 * Crea un nuovo utente
 */
import bcrypt from 'bcryptjs';

export const createUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email, password, nome, cognome, ruolo } = req.body;

    if (!email || !password || !nome || !cognome) {
        return res.status(400).json({ success: false, error: 'Campi obbligatori mancanti' });
    }

    // Verifica email unica
    const existing = await prisma.utente.findUnique({ where: { email } });
    if (existing) {
        return res.status(409).json({ success: false, error: 'Email già registrata' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = await prisma.utente.create({
        data: {
            email,
            passwordHash,
            nome,
            cognome,
            ruolo: ruolo || 'merchant',
            attivo: true
        }
    });

    res.status(201).json({
        success: true,
        message: 'Utente creato con successo',
        data: {
            id: newUser.id,
            email: newUser.email,
            nome: newUser.nome,
            cognome: newUser.cognome,
            ruolo: newUser.ruolo,
            attivo: newUser.attivo,
            createdAt: newUser.createdAt
        }
    });
});

/**
 * PUT /api/admin/users/:id
 * Aggiorna stato o ruolo di un utente
 */
export const updateUserStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { attivo, ruolo } = req.body;

    const updated = await prisma.utente.update({
        where: { id: parseInt(id) },
        data: { attivo, ruolo }
    });

    res.json({
        success: true,
        message: 'Utente aggiornato correttamente',
        data: updated
    });
});

/**
 * GET /api/admin/stats
 * Statistiche globali del sistema
 */
export const getGlobalStats = asyncHandler(async (req: AuthRequest, res: Response) => {
    const [userCount, productsCount, logsCount, providersCount] = await Promise.all([
        prisma.utente.count(),
        prisma.masterFile.count(),
        prisma.logElaborazione.count(),
        prisma.fornitore.count()
    ]);

    res.json({
        success: true,
        data: {
            totalMerchants: userCount,
            totalProductsInSystem: productsCount,
            totalLogs: logsCount,
            totalActiveProviders: providersCount
        }
    });
});

/**
 * GET /api/admin/health
 * Stato di salute del server e del database
 */
import os from 'os';

export const getSystemHealth = asyncHandler(async (req: AuthRequest, res: Response) => {
    const memTotal = os.totalmem();
    const memFree = os.freemem();
    const cpuLoad = os.loadavg();

    // Statistiche DB per tabella
    const tableStats = await Promise.all([
        prisma.listinoRaw.count().then(c => ({ table: 'listini_raw', count: c })),
        prisma.masterFile.count().then(c => ({ table: 'master_file', count: c })),
        prisma.datiIcecat.count().then(c => ({ table: 'dati_icecat', count: c })),
        prisma.logElaborazione.count().then(c => ({ table: 'log_elaborazioni', count: c })),
        prisma.outputShopify.count().then(c => ({ table: 'output_shopify', count: c })),
    ]);

    res.json({
        success: true,
        data: {
            server: {
                platform: os.platform(),
                uptime: os.uptime(),
                memory: {
                    total: Math.round(memTotal / 1024 / 1024) + 'MB',
                    free: Math.round(memFree / 1024 / 1024) + 'MB',
                    usedPercent: Math.round(((memTotal - memFree) / memTotal) * 100)
                },
                cpuLoad: cpuLoad[0].toFixed(2)
            },
            database: {
                tables: tableStats
            }
        }
    });
});

/**
 * POST /api/admin/settings
 * Aggiorna impostazioni globali (utenteId null)
 */
export const updateGlobalSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
    const settings = req.body; // { chiave: valore }

    if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ success: false, error: 'Dati impostazioni non validi' });
    }

    const results = [];
    for (const [chiave, valore] of Object.entries(settings)) {
        const updated = await (prisma.configurazioneSistema as any).upsert({
            where: {
                utenteId_chiave: {
                    utenteId: null,
                    chiave
                }
            },
            update: { valore: String(valore) },
            create: {
                utenteId: null,
                chiave,
                valore: String(valore),
                tipo: 'string'
            }
        });
        results.push(updated);
    }

    res.json({
        success: true,
        message: 'Impostazioni globali aggiornate',
        data: results
    });
});

/**
 * GET /api/admin/logs
 * Log di sistema aggregati
 */
export const getSystemLogs = asyncHandler(async (req: AuthRequest, res: Response) => {
    const logs = await (prisma.logElaborazione as any).findMany({
        take: 100,
        orderBy: { dataEsecuzione: 'desc' },
        include: {
            utente: {
                select: { email: true }
            }
        }
    });

    res.json({
        success: true,
        data: logs
    });
});

/**
 * DELETE /api/admin/users/:id
 * Elimina definitivamente un utente e tutti i suoi dati
 */
export const deleteUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = parseInt(id);

    if (userId === 1) {
        return res.status(403).json({ success: false, error: 'Non è possibile eliminare l\'amministratore principale' });
    }

    await prisma.utente.delete({
        where: { id: userId }
    });

    res.json({
        success: true,
        message: 'Utente eliminato definitivamente'
    });
});
