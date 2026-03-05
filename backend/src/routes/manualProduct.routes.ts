import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { createManualProduct } from '../controllers/manualProduct.controller';

const router = Router();

router.use(authMiddleware);

router.post('/create', createManualProduct);

export default router;
