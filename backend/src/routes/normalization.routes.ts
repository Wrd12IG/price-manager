// @ts-nocheck
import { Router } from 'express';
import * as normalizationController from '../controllers/normalization.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/stats/:type', normalizationController.getStats);
router.get('/duplicates/:type', normalizationController.getDuplicates);
router.get('/search/:type', normalizationController.search);
router.post('/merge/:type', normalizationController.mergeItems);
router.delete('/clean-orphans/:type', normalizationController.cleanOrphans);
router.post('/auto-normalize', normalizationController.autoNormalize);
router.get('/quality-issues', normalizationController.getQualityIssues);
router.post('/quality-fixes', normalizationController.applyQualityFixes);

export default router;
