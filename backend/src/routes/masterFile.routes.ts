import { Router } from 'express';
import { getMasterFile, consolidateMasterFile } from '../controllers/masterFile.controller';

const router = Router();

router.get('/', getMasterFile);
router.post('/consolidate', consolidateMasterFile);

export default router;
