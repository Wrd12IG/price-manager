import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { ManualProductService } from '../services/ManualProductService';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const createManualProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    if (!utenteId) throw new AppError('Non autorizzato', 401);

    const { ean, nome, marca, categoria, descrizione, specifiche, immagini, prezzo, quantita, pushImmediately } = req.body;

    if (!ean) throw new AppError('EAN obbligatorio', 400);

    logger.info(`📝 Creazione manuale prodotto per EAN: ${ean} (Utente: ${utenteId})`);

    const result = await ManualProductService.createAndPrepare(utenteId, {
        ean, nome, marca, categoria, descrizione, specifiche, immagini, prezzo, quantita
    });

    let shopifyResult = null;
    if (pushImmediately) {
        shopifyResult = await ManualProductService.pushToShopify(utenteId, result.outputId);
    }

    res.json({
        success: true,
        message: 'Prodotto creato e preparato per Shopify',
        data: {
            ...result,
            shopify: shopifyResult
        }
    });
});
