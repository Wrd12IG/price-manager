import { Router } from 'express';
import {
    getAllFornitori,
    getFornitoreById,
    createFornitore,
    updateFornitore,
    deleteFornitore,
    testConnection,
    previewListino,
    importListino,
    getImportStatus,
    importAllListini,
    getFilterOptions,
    getSupplierFilter,
    upsertSupplierFilter,
    deleteSupplierFilter
} from '../controllers/fornitori.controller';

import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Protezione multi-tenant
router.use(authMiddleware);

// CRUD routes
router.get('/', getAllFornitori);
router.get('/:id', getFornitoreById);
router.post('/', createFornitore);
router.put('/:id', updateFornitore);
router.delete('/:id', deleteFornitore);

// Utility routes
router.post('/import-all', importAllListini);
router.post('/:id/test-connection', testConnection);
router.get('/:id/preview', previewListino);
router.post('/:id/import', importListino);
router.get('/:id/import-status', getImportStatus);

// Supplier filter routes
router.get('/:id/filter-options', getFilterOptions);
router.get('/:id/filter', getSupplierFilter);
router.post('/:id/filter', upsertSupplierFilter);
router.delete('/filters/:filterId', deleteSupplierFilter);

export default router;
