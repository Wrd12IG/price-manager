import { Router } from 'express';
import { getMarche, getCategorie } from '../controllers/catalog.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/marche', getMarche);
router.get('/categorie', getCategorie);

export default router;
