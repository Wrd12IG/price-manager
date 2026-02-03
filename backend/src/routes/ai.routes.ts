import { Router } from 'express';
import { aiEnrichmentController } from '../controllers/AIEnrichmentController';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Protezione multi-tenant
router.use(authMiddleware);

router.post('/enrich', aiEnrichmentController.enrichBatch);
router.get('/stats', aiEnrichmentController.getStats);

export default router;
