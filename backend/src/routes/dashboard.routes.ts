import { Router } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /api/dashboard/stats
 * Statistiche dashboard
 */
router.get('/stats', asyncHandler(async (req: any, res: any) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Prepare promises
    const pTotalFornitori = prisma.fornitore.count({ where: { attivo: true } });
    const pTotalProdotti = prisma.masterFile.count();

    // Prodotti sincronizzati con Shopify oggi
    const pSyncOggi = prisma.outputShopify.count({
        where: {
            statoCaricamento: 'uploaded',
            updatedAt: { gte: today }
        }
    });

    // Activity 1: Recent Workflow Logs
    const pRecentLogs = prisma.logElaborazione.findMany({
        orderBy: { dataEsecuzione: 'desc' },
        take: 8,
        select: { faseProcesso: true, stato: true, dataEsecuzione: true, prodottiProcessati: true }
    });

    // Chart Data: Workflow Executions per day
    const pWorkflowPerDay = prisma.$queryRaw`
        SELECT DATE(dataEsecuzione) as date, COUNT(*) as count 
        FROM log_elaborazioni 
        WHERE dataEsecuzione >= ${sevenDaysAgo} 
        AND faseProcesso = 'WORKFLOW_COMPLETO'
        GROUP BY DATE(dataEsecuzione)
    `;

    // Chart Data: Shopify Uploads per day
    const pShopifyPerDay = prisma.$queryRaw`
        SELECT DATE(updatedAt) as date, COUNT(*) as count 
        FROM output_shopify 
        WHERE updatedAt >= ${sevenDaysAgo} 
        AND statoCaricamento = 'uploaded'
        GROUP BY DATE(updatedAt)
    `;

    const [
        totalFornitori,
        totalProdotti,
        syncOggi,
        recentLogs,
        workflowPerDayRaw,
        shopifyPerDayRaw
    ] = await Promise.all([
        pTotalFornitori,
        pTotalProdotti,
        pSyncOggi,
        pRecentLogs,
        pWorkflowPerDay,
        pShopifyPerDay
    ]);

    // --- ACTIVITY FORMATTING ---
    const recentActivity = recentLogs.map(log => {
        let text = '';
        let status: 'success' | 'error' | 'info' = 'info';

        if (log.faseProcesso === 'WORKFLOW_COMPLETO') {
            text = log.stato === 'success' ? 'Workflow completato con successo' : 'Workflow terminato con errori';
            status = log.stato === 'success' ? 'success' : 'error';
        } else if (log.faseProcesso === 'IMPORT_LISTINI') {
            text = `Import listini: ${log.prodottiProcessati} fornitori`;
            status = log.stato === 'success' ? 'success' : 'error';
        } else if (log.faseProcesso === 'SYNC_SHOPIFY') {
            text = `Sync Shopify: ${log.prodottiProcessati} prodotti`;
            status = log.stato === 'success' ? 'success' : log.stato === 'warning' ? 'info' : 'error';
        } else if (log.faseProcesso === 'ARRICCHIMENTO_DATI') {
            text = `Arricchimento: ${log.prodottiProcessati} prodotti`;
            status = 'success';
        } else if (log.faseProcesso === 'EXPORT_SHOPIFY') {
            text = `Export preparato: ${log.prodottiProcessati} prodotti`;
            status = 'success';
        } else {
            text = log.faseProcesso.replace(/_/g, ' ');
            status = log.stato === 'success' ? 'success' : 'error';
        }

        return {
            text,
            status,
            time: new Date(log.dataEsecuzione).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) +
                ' ' + new Date(log.dataEsecuzione).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
        };
    });

    // --- CHART DATA FORMATTING ---
    const workflowMap = new Map<string, number>();
    const shopifyMap = new Map<string, number>();

    const parseRawData = (raw: any, map: Map<string, number>) => {
        if (Array.isArray(raw)) {
            raw.forEach((row: any) => {
                let key = '';
                if (typeof row.date === 'string') {
                    key = row.date.split('T')[0];
                } else if (row.date instanceof Date) {
                    key = row.date.toISOString().split('T')[0];
                }
                const count = typeof row.count === 'bigint' ? Number(row.count) : Number(row.count);
                if (key) map.set(key, count);
            });
        }
    };

    parseRawData(workflowPerDayRaw, workflowMap);
    parseRawData(shopifyPerDayRaw, shopifyMap);

    const formattedChartData = [];
    for (let d = new Date(sevenDaysAgo); d <= new Date(); d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split('T')[0];
        const dayLabel = d.toLocaleDateString('it-IT', { weekday: 'short' });
        const dayLabelCap = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);

        formattedChartData.push({
            name: dayLabelCap,
            workflow: workflowMap.get(key) || 0,
            shopify: shopifyMap.get(key) || 0
        });
    }

    // Determine "Ultima Esecuzione" based on latest log
    const lastLog = recentLogs.length > 0 ? recentLogs[0] : null;
    const lastActivityTime = lastLog ? new Date(lastLog.dataEsecuzione) : null;

    res.json({
        success: true,
        data: {
            totalFornitori,
            totalProdotti,
            ultimaEsecuzione: lastActivityTime,
            prodottiImportatiOggi: syncOggi, // Ora mostra sync Shopify di oggi
            chartData: formattedChartData,
            recentActivity: recentActivity
        }
    });
}));

export default router;

