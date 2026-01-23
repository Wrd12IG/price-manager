import { Router } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.get('/stats', asyncHandler(async (req: any, res: any) => {
    try {
        // Test rapido connessione
        await prisma.$connect();

        const [totalFornitori, totalProdotti] = await Promise.all([
            prisma.fornitore.count().catch(() => 0),
            prisma.masterFile.count().catch(() => 0)
        ]);

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
    } catch (dbError: any) {
        console.error('DATABASE CONNECTION ERROR:', dbError);
        res.status(500).json({
            success: false,
            error: `Errore DB: ${dbError.message}`
        });
    }
}));

export default router;
