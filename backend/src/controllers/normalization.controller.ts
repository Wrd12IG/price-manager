import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { NormalizationService } from '../services/NormalizationService';
import { logger } from '../utils/logger';
import prisma from '../config/database';

export const getStats = async (req: any, res: Response) => {
    try {
        const { type } = req.params;
        const stats = await NormalizationService.getStats(type as any);
        res.json(stats);
    } catch (error: any) {
        logger.error('Errore getStats normalization:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getDuplicates = async (req: any, res: Response) => {
    try {
        const { type } = req.params;
        const duplicates = await NormalizationService.getPotentialDuplicates(type as any);
        res.json(duplicates);
    } catch (error: any) {
        logger.error('Errore getDuplicates normalization:', error);
        res.status(500).json({ error: error.message });
    }
};

export const mergeItems = async (req: any, res: Response) => {
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

export const search = async (req: any, res: Response) => {
    try {
        const { type } = req.params;
        const { q } = req.query;
        // P3: Se nessuna query, restituisci i top items per pre-caricare il dropdown
        if (!q) {
            const topItems = await NormalizationService.getTopItems(type as any);
            return res.json(topItems);
        }
        const results = await NormalizationService.search(type as any, q as string);
        res.json(results);
    } catch (error: any) {
        logger.error('Errore search normalization:', error);
        res.status(500).json({ error: error.message });
    }
};

// P2b: Cleanup marchi/categorie orfane (0 prodotti)
export const cleanOrphans = async (req: any, res: Response) => {
    try {
        const { type } = req.params;
        const deleted = await NormalizationService.cleanOrphans(type as any);
        res.json({ success: true, deleted, type });
    } catch (error: any) {
        logger.error('Errore cleanOrphans normalization:', error);
        res.status(500).json({ error: error.message });
    }
};

// P3b: Auto-normalizzazione batch via Icecat
export const autoNormalize = async (req: any, res: Response) => {
    try {
        const utenteId = req.utenteId; // Solo per l'utente corrente se specificato, altrimenti globale se admin
        const result = await NormalizationService.autoNormalizeAllCategories(utenteId ? Number(utenteId) : null);
        res.json({ success: true, ...result });
    } catch (error: any) {
        logger.error('Errore autoNormalize normalization:', error);
        res.status(500).json({ error: error.message });
    }
};
