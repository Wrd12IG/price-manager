import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { NormalizationService } from '../services/NormalizationService';
import { logger } from '../utils/logger';

export const getStats = async (req: AuthRequest, res: Response) => {
    try {
        const { type } = req.params;
        const stats = await NormalizationService.getStats(type as any);
        res.json(stats);
    } catch (error: any) {
        logger.error('Errore getStats normalization:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getDuplicates = async (req: AuthRequest, res: Response) => {
    try {
        const { type } = req.params;
        const duplicates = await NormalizationService.getPotentialDuplicates(type as any);
        res.json(duplicates);
    } catch (error: any) {
        logger.error('Errore getDuplicates normalization:', error);
        res.status(500).json({ error: error.message });
    }
};

export const mergeItems = async (req: AuthRequest, res: Response) => {
    try {
        const { type } = req.params;
        const { sourceId, targetId, global } = req.body;
        const utenteId = global ? null : req.utenteId;

        if (!sourceId || !targetId) {
            return res.status(400).json({ error: 'ID sorgente e target obbligatori' });
        }

        await NormalizationService.merge(type as any, Number(sourceId), Number(targetId), utenteId ? Number(utenteId) : null);
        res.json({ success: true });
    } catch (error: any) {
        logger.error('Errore merge normalization:', error);
        res.status(500).json({ error: error.message });
    }
};
