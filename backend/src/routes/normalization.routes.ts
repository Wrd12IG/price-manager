// @ts-nocheck
import { Router } from 'express';
import * as normalizationController from '../controllers/normalization.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/stats/:type', normalizationController.getStats);
router.get('/duplicates/:type', normalizationController.getDuplicates);
router.post('/merge/:type', normalizationController.mergeItems);

export default router;
