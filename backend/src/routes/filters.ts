import { Router } from 'express';
import { productFilterController } from '../controllers/ProductFilterController';

const router = Router();

// ============================================
// ROUTES PER REGOLE DI FILTRO
// ============================================

// Ottiene le opzioni disponibili (marche, categorie)
router.get('/options', (req, res) => productFilterController.getOptions(req, res));

// Ottiene i conteggi dinamici (facet counts)
router.get('/facets', (req, res) => productFilterController.getFacetCounts(req, res));

// Ottiene tutte le regole
router.get('/rules', (req, res) => productFilterController.getRules(req, res));

// Crea una nuova regola
router.post('/rules', (req, res) => productFilterController.createRule(req, res));

// Aggiorna una regola
router.put('/rules/:id', (req, res) => productFilterController.updateRule(req, res));

// Elimina una regola
router.delete('/rules/:id', (req, res) => productFilterController.deleteRule(req, res));

// Attiva/disattiva una regola
router.patch('/rules/:id/toggle', (req, res) => productFilterController.toggleRule(req, res));

// ============================================
// ROUTES PER TEST FILTRI
// ============================================

// Testa un singolo prodotto
router.post('/test', (req, res) => productFilterController.testFilter(req, res));

// Testa un batch di prodotti
router.post('/batch-test', (req, res) => productFilterController.batchTestFilter(req, res));

// ============================================
// ROUTES PER PRESET
// ============================================

// Ottiene tutti i preset
router.get('/presets', (req, res) => productFilterController.getPresets(req, res));

// Ottiene il preset attivo
router.get('/presets/active', (req, res) => productFilterController.getActivePreset(req, res));

// Attiva un preset
router.post('/presets/:id/activate', (req, res) => productFilterController.activatePreset(req, res));

export default router;
