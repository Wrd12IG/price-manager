import { Router } from 'express';
import {
    getCampiStandard,
    getMappaturaFornitore,
    saveMappaturaFornitore
} from '../controllers/mappature.controller';

const router = Router();

// Campi
router.get('/campi/standard', getCampiStandard);
router.get('/campi/:fornitoreId', getMappaturaFornitore);
router.post('/campi/:fornitoreId', saveMappaturaFornitore);

// Categorie (Placeholder per ora)
router.get('/categorie', (req, res) => {
    res.json({ message: 'Mappature categorie da implementare' });
});

export default router;
