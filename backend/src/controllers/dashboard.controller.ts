// @ts-nocheck
import { Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';

/**
 * GET /api/dashboard/stats
 * Statistiche della dashboard per l'utente autenticato (Multi-Tenant)
 */
export const getDashboardStats = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const isAdmin = req.user?.ruolo === 'admin' || utenteId === 1;
    const effectiveUtenteId = isAdmin ? null : utenteId;

    try {
        const [totalFornitori, totalProdotti, ultimaEsecuzione, prodottiImportatiOggi, recentLogs] = await Promise.all([
            (prisma.fornitore as any).count({ where: isAdmin ? {} : { utenteId } }),
            (prisma.masterFile as any).count({ where: isAdmin ? {} : { utenteId } }),
            (prisma.logElaborazione as any).findFirst({
                where: isAdmin ? { stato: 'completed' } : { utenteId, stato: 'completed' },
                orderBy: { dataEsecuzione: 'desc' },
                select: { dataEsecuzione: true }
            }),
            (prisma.logElaborazione as any).aggregate({
                where: {
                    ...(isAdmin ? {} : { utenteId }),
                    faseProcesso: { contains: 'IMPORT' },
                    dataEsecuzione: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                },
                _sum: { prodottiProcessati: true }
            }),
            (prisma.logElaborazione as any).findMany({
                where: isAdmin ? {} : { utenteId },
                take: 5,
                orderBy: { dataEsecuzione: 'desc' }
            })
        ]);

        const recentActivity = recentLogs.map((log: any) => ({
            text: `${log.faseProcesso}: ${log.stato === 'completed' ? 'Completato con successo' : 'Errore rilevato'}`,
            status: log.stato === 'completed' ? 'success' : log.stato === 'error' ? 'error' : 'info',
            time: new Date(log.dataEsecuzione).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
        }));

        res.json({
            success: true,
            data: {
                totalFornitori,
                totalProdotti,
                ultimaEsecuzione: ultimaEsecuzione?.dataEsecuzione || null,
                prodottiImportatiOggi: prodottiImportatiOggi._sum.prodottiProcessati || 0,
                chartData: [],
                recentActivity
            }
        });
    } catch (error: any) {
        console.error(`[Dashboard] Errore stats utente ${utenteId}:`, error.message);
        res.status(500).json({
            success: false,
            error: 'Errore nel caricamento delle statistiche'
        });
    }
});
