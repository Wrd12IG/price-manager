import { Router } from 'express';
import {
    getMarchi,
    getMarchioById,
    createMarchio,
    updateMarchio,
    deleteMarchio,
    cleanupMarchi
} from '../controllers/marchi.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Tutte le rotte dei marchi richiedono autenticazione
router.use(authMiddleware);

router.get('/', getMarchi);
router.post('/cleanup', cleanupMarchi);
router.get('/:id', getMarchioById);
router.post('/', createMarchio);
router.put('/:id', updateMarchio);
router.delete('/:id', deleteMarchio);

export default router;
