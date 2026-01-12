import { Router } from 'express';
import { getConfig, saveConfig, enrichProducts, getEnriched, getProgress, exportCSV, exportJSON, exportHTML } from '../controllers/icecat.controller';

const router = Router();

router.get('/config', getConfig);
router.post('/config', saveConfig);
router.post('/enrich', enrichProducts);
router.get('/enriched', getEnriched);
router.get('/progress', getProgress);
router.get('/export/csv', exportCSV);
router.get('/export/json', exportJSON);
router.get('/export/html', exportHTML);

export default router;
