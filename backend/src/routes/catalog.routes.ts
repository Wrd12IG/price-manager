import { Router } from 'express';
import { getMarche, getCategorie } from '../controllers/catalog.controller';

const router = Router();

router.get('/marche', getMarche);
router.get('/categorie', getCategorie);

export default router;
