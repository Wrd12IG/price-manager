import { Router } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.get('/stats', asyncHandler(async (req: any, res: any) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Query standard (più sicure di queryRaw per PostgreSQL)
    const [totalFornitori, totalProdotti, syncOggi, recentLogs] = await Promise.all([
        prisma.fornitore.count({ where: { attivo: true } }),
        prisma.masterFile.count(),
        prisma.outputShopify.count({
            where: {
                statoCaricamento: 'uploaded',
                updatedAt: { gte: today }
            }
        }),
        prisma.logElaborazione.findMany({
            orderBy: { dataEsecuzione: 'desc' },
            take: 8
        })
    ]);

    // Formattazione attività recente (con sicurezza null)
    const recentActivity = (recentLogs || []).map(log => {
        let text = log.faseProcesso?.replace(/_/g, ' ') || 'Attività generica';
        let status: 'success' | 'error' | 'info' = log.stato === 'success' ? 'success' : log.stato === 'warning' ? 'info' : 'error';

        if (log.faseProcesso === 'WORKFLOW_COMPLETO') {
            text = log.stato === 'success' ? 'Workflow completato' : 'Workflow con errori';
        } else if (log.faseProcesso === 'IMPORT_LISTINI') {
            text = `Import: ${log.prodottiProcessati} prodotti`;
        }

        return {
            text,
            status,
            time: new Date(log.dataEsecuzione).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) +
                ' ' + new Date(log.dataEsecuzione).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
        };
    });

    // Generiamo dati grafici vuoti ma validi per evitare crash
    const formattedChartData = [];
    for (let d = new Date(sevenDaysAgo); d <= new Date(); d.setDate(d.getDate() + 1)) {
        const dayLabel = d.toLocaleDateString('it-IT', { weekday: 'short' });
        formattedChartData.push({
            name: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1),
            workflow: 0,
            shopify: 0
        });
    }

    res.json({
        success: true,
        data: {
            totalFornitori,
            totalProdotti,
            ultimaEsecuzione: recentLogs[0]?.dataEsecuzione || null,
            prodottiImportatiOggi: syncOggi,
            chartData: formattedChartData,
            recentActivity
        }
    });
}));

export default router;
