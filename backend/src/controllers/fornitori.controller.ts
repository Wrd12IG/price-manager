import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ImportService } from '../services/ImportService';
import { AppError } from '../middleware/errorHandler';
import prisma from '../config/database';
import { logger } from '../utils/logger';

// Questa versione del controller RISPONDE SUBITO per evitare il 500 di Render
export const importListino = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const fornitoreId = parseInt(id);

    // 1. Verifichiamo subito se il fornitore esiste (Operazione veloce)
    const fornitore = await prisma.fornitore.findUnique({ where: { id: fornitoreId } });
    if (!fornitore) throw new AppError('Fornitore non trovato', 404);

    // 2. Lanciamo l'importazione in background e NON Aspettiamo (no await)
    // Usiamo una funzione auto-invocata per gestire eventuali errori nel log
    (async () => {
        try {
            logger.info(`[BACKGROUND] Avvio importazione fornitore ${fornitoreId}`);
            await ImportService.importaListino(fornitoreId);
        } catch (err: any) {
            logger.error(`[BACKGROUND CRASH] Fornitore ${fornitoreId}: ${err.message}`);
        }
    })();

    // 3. Rispondiamo istantaneamente al browser
    return res.status(200).json({
        success: true,
        message: 'Importazione avviata correttamente. I prodotti compariranno tra pochi minuti.',
        data: { status: 'processing' }
    });
});
