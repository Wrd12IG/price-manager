import { Router } from 'express';
import { getMasterFile, consolidateMasterFile, getMasterFileFilters } from '../controllers/masterFile.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Protezione multi-tenant
router.use(authMiddleware);

router.get('/', getMasterFile);
router.get('/filters', getMasterFileFilters);
router.post('/consolidate', consolidateMasterFile);

export default router;
