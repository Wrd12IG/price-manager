import { Router } from 'express';
import { getConfig, saveConfig, syncProducts, generateExport, getPreview, getProgress, downloadCSV, savePlaceholder } from '../controllers/shopify.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Protezione multi-tenant
router.use(authMiddleware);

router.get('/config', getConfig);
router.post('/config', saveConfig);
router.post('/placeholder', savePlaceholder);
router.post('/generate', generateExport);
router.post('/sync', syncProducts);
router.get('/preview', getPreview);
router.get('/progress', getProgress);
router.get('/export/csv', downloadCSV);

export default router;
