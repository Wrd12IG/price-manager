import { Router } from 'express';
import { getConfig, saveConfig, syncProducts, generateExport, getPreview, getProgress, downloadCSV, savePlaceholder } from '../controllers/shopify.controller';

const router = Router();

router.get('/config', getConfig);
router.post('/config', saveConfig);
router.post('/placeholder', savePlaceholder);
router.post('/generate', generateExport);  // Genera export senza sincronizzare
router.post('/sync', syncProducts);
router.get('/preview', getPreview);
router.get('/progress', getProgress);
router.get('/export/csv', downloadCSV);

export default router;
