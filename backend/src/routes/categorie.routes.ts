import { Router } from 'express';
import {
    getCategorie,
    getCategoriaById,
    createCategoria,
    updateCategoria,
    deleteCategoria
} from '../controllers/categorie.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Tutte le rotte delle categorie richiedono autenticazione
router.use(authMiddleware);

router.get('/', getCategorie);
router.get('/:id', getCategoriaById);
router.post('/', createCategoria);
router.put('/:id', updateCategoria);
router.delete('/:id', deleteCategoria);

export default router;
