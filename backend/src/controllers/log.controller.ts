import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export class LogController {

    /**
     * Recupera i log con paginazione e filtri
     */
    static async getLogs(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const stato = req.query.stato as string; // success, error, warning
            const fase = req.query.fase as string; // EXPORT_SHOPIFY, ecc

            const skip = (page - 1) * limit;

            const where: any = {};
            if (stato) where.stato = stato;
            if (fase) where.faseProcesso = fase;

            const [total, logs] = await Promise.all([
                prisma.logElaborazione.count({ where }),
                prisma.logElaborazione.findMany({
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
            logger.error('Errore recupero logs:', error);
            res.status(500).json({ success: false, error: 'Errore interno server' });
        }
    }

    /**
     * Recupera le statistiche dell'ultimo workflow
     */
    static async getLatestWorkflowStats(req: Request, res: Response) {
        try {
            // Cerca l'ultimo log "WORKFLOW_COMPLETO"
            const lastWorkflow = await prisma.logElaborazione.findFirst({
                where: { faseProcesso: 'WORKFLOW_COMPLETO' },
                orderBy: { dataEsecuzione: 'desc' }
            });

            if (!lastWorkflow) {
                res.json({ success: true, data: null });
                return;
            }

            // Recupera dettaglio delle fasi di quel workflow (basato su data simile)
            const startTime = new Date(lastWorkflow.dataEsecuzione).getTime();
            const endTime = new Date(lastWorkflow.dataEsecuzione).getTime() + ((lastWorkflow.durataSecondi || 0) * 1000);

            // Flessibilità di 5 secondi
            const startWindow = new Date(startTime - 5000);
            const endWindow = new Date(endTime + 5000);

            const logsFasi = await prisma.logElaborazione.findMany({
                where: {
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
            logger.error('Errore recupero stats workflow:', error);
            res.status(500).json({ success: false, error: 'Errore interno server' });
        }
    }
}
