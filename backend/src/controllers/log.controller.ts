// @ts-nocheck
import { Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth.middleware';

export class LogController {

    /**
     * Recupera i log con paginazione e filtri (Multi-Tenant)
     */
    static async getLogs(req: AuthRequest, res: Response) {
        try {
            const utenteId = req.utenteId || 1;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const stato = req.query.stato as string;
            const fase = req.query.fase as string;

            const skip = (page - 1) * limit;

            const where: any = { utenteId };
            if (stato) where.stato = stato;
            if (fase) where.faseProcesso = fase;

            const [total, logs] = await Promise.all([
                (prisma.logElaborazione as any).count({ where }),
                (prisma.logElaborazione as any).findMany({
                    where,
                    orderBy: { dataEsecuzione: 'desc' },
                    skip,
                    take: limit
                })
            ]);

            res.json({
                success: true,
                data: logs,
                pagination: {
                    total,
                    page,
                    limit,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error: any) {
            logger.error(`[Logs] Errore recupero logs utente ${req.utenteId}:`, error);
            res.status(500).json({ success: false, error: 'Errore interno server' });
        }
    }

    /**
     * Recupera le statistiche dell'ultimo workflow (Multi-Tenant)
     */
    static async getLatestWorkflowStats(req: AuthRequest, res: Response) {
        try {
            const utenteId = req.utenteId || 1;

            // Cerca l'ultimo log "WORKFLOW_COMPLETO" per questo utente
            const lastWorkflow = await (prisma.logElaborazione as any).findFirst({
                where: { utenteId, faseProcesso: 'WORKFLOW_COMPLETO' },
                orderBy: { dataEsecuzione: 'desc' }
            });

            if (!lastWorkflow) {
                res.json({ success: true, data: null });
                return;
            }

            // Recupera dettaglio delle fasi di quel workflow
            // Prendiamo i log dell'utente in un raggio temporale vicino
            const startTime = new Date(lastWorkflow.dataEsecuzione).getTime();
            const duration = lastWorkflow.durataSecondi || 0;

            const startWindow = new Date(startTime - 10000); // 10s prima
            const endWindow = new Date(startTime + (duration * 1000) + 10000); // 10s dopo la fine dichiarata

            const logsFasi = await (prisma.logElaborazione as any).findMany({
                where: {
                    utenteId,
                    dataEsecuzione: {
                        gte: startWindow,
                        lte: endWindow
                    },
                    id: { not: lastWorkflow.id }
                },
                orderBy: { dataEsecuzione: 'asc' }
            });

            res.json({
                success: true,
                data: {
                    workflow: lastWorkflow,
                    fasi: logsFasi
                }
            });

        } catch (error: any) {
            logger.error(`[Logs] Errore recupero stats workflow utente ${req.utenteId}:`, error);
            res.status(500).json({ success: false, error: 'Errore interno server' });
        }
    }

    /**
     * Recupera dati analitici per i grafici
     */
    static async getLogAnalytics(req: AuthRequest, res: Response) {
        try {
            const utenteId = req.utenteId || 1;
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const logs = await (prisma.logElaborazione as any).findMany({
                where: { utenteId, dataEsecuzione: { gte: sevenDaysAgo } },
                select: { dataEsecuzione: true, stato: true, faseProcesso: true }
            });

            const dailyData: Record<string, { day: string, success: number, error: number }> = {};
            const phaseData: Record<string, number> = {};
            let totalSuccess = 0;
            let totalError = 0;

            logs.forEach((log: any) => {
                const day = new Date(log.dataEsecuzione).toISOString().split('T')[0];
                if (!dailyData[day]) dailyData[day] = { day, success: 0, error: 0 };

                const isSuccess = ['success', 'completed', 'successo'].includes(log.stato.toLowerCase());
                const isError = ['error', 'failed', 'errore'].includes(log.stato.toLowerCase());

                if (isSuccess) {
                    dailyData[day].success++;
                    totalSuccess++;
                } else if (isError) {
                    dailyData[day].error++;
                    totalError++;
                }

                const phase = log.faseProcesso;
                phaseData[phase] = (phaseData[phase] || 0) + 1;
            });

            const daily = Object.values(dailyData).sort((a, b) => a.day.localeCompare(b.day));
            const phases = Object.entries(phaseData).map(([name, value]) => ({ name, value }));

            res.json({
                success: true,
                data: {
                    daily,
                    phases,
                    summary: {
                        totalSuccess,
                        totalError,
                        successRate: logs.length > 0 ? Math.round((totalSuccess / logs.length) * 100) : 0
                    }
                }
            });
        } catch (error: any) {
            logger.error(`[Logs] Errore recupero analytics logs:`, error);
            res.status(500).json({ success: false, error: 'Errore interno server' });
        }
    }
}
