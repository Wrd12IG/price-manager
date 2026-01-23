import { Router } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.get('/stats', asyncHandler(async (req: any, res: any) => {
    try {
        // Query ultra-veloci senza join per testare se il DB risponde
        const totalFornitori = await prisma.fornitore.count().catch(() => 0);
        const totalProdotti = await prisma.masterFile.count().catch(() => 0);

        res.json({
            success: true,
            data: {
                totalFornitori,
                totalProdotti,
                ultimaEsecuzione: null,
                prodottiImportatiOggi: 0,
                chartData: [],
                recentActivity: []
            }
        });
    } catch (error: any) {
        console.error('DASHBOARD ERROR:', error.message);
        res.json({
            success: true,
            data: {
                totalFornitori: 0,
                totalProdotti: 0,
                ultimaEsecuzione: null,
                prodottiImportatiOggi: 0,
                chartData: [],
                recentActivity: [],
                dbStatus: "warning"
            }
        });
    }
}));

export default router;
