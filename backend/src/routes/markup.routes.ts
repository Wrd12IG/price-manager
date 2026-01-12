import { Router } from 'express';
import {
    getRegole,
    createRegola,
    deleteRegola,
    calculatePrices,
    getOptions
} from '../controllers/markup.controller';

const router = Router();

router.get('/', getRegole);
router.post('/', createRegola);
router.delete('/:id', deleteRegola);
router.post('/calculate', calculatePrices);
router.get('/options', getOptions);

export default router;
