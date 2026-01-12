import { Router } from 'express';
import {
    getMarchi,
    getMarchioById,
    createMarchio,
    updateMarchio,
    deleteMarchio
} from '../controllers/marchi.controller';

const router = Router();

router.get('/', getMarchi);
router.get('/:id', getMarchioById);
router.post('/', createMarchio);
router.put('/:id', updateMarchio);
router.delete('/:id', deleteMarchio);

export default router;
