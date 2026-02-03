import { Router } from 'express';
import {
    getRegole,
    createRegola,
    deleteRegola,
    calculatePrices,
    getOptions
} from '../controllers/markup.controller';

import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getRegole);
router.post('/', createRegola);
router.delete('/:id', deleteRegola);
router.post('/calculate', calculatePrices);
router.get('/options', getOptions);

export default router;
